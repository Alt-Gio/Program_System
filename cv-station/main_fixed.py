import cv2
import numpy as np
import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
import datetime
from pathlib import Path
import threading
import logging
import sqlite3
import csv
import requests
import json
from typing import Optional
import time
import base64
import ctypes
from ctypes import wintypes

APP_NAME    = "DICT-FaceCheckin"
APP_VERSION = "1.0.0"

# ─── Config location (per-user roaming AppData on Windows) ────────────────────
def _config_dir() -> Path:
    base = os.getenv("APPDATA") or os.path.expanduser("~")
    d = Path(base) / APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d

CONFIG_PATH = _config_dir() / "config.json"


# ─── Windows DPAPI (encrypt at rest, tied to user account) ────────────────────
# Uses crypt32.dll via ctypes so we don't need pywin32. On non-Windows we
# fall back to base64 — fine because the target is Windows.
class _DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _dpapi_protect(plaintext: str) -> str:
    if sys.platform != "win32":
        return "b64:" + base64.b64encode(plaintext.encode()).decode()
    data = plaintext.encode("utf-8")
    in_blob = _DATA_BLOB(len(data), ctypes.cast(ctypes.c_char_p(data), ctypes.POINTER(ctypes.c_byte)))
    out_blob = _DATA_BLOB()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)
    ):
        raise OSError("DPAPI CryptProtectData failed")
    out = ctypes.string_at(out_blob.pbData, out_blob.cbData)
    ctypes.windll.kernel32.LocalFree(out_blob.pbData)
    return "dpapi:" + base64.b64encode(out).decode()


def _dpapi_unprotect(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    if ciphertext.startswith("b64:"):
        return base64.b64decode(ciphertext[4:]).decode()
    if ciphertext.startswith("dpapi:"):
        if sys.platform != "win32":
            raise OSError("dpapi blob cannot be decrypted off Windows")
        raw = base64.b64decode(ciphertext[6:])
        buf = (ctypes.c_byte * len(raw)).from_buffer_copy(raw)
        in_blob = _DATA_BLOB(len(raw), ctypes.cast(buf, ctypes.POINTER(ctypes.c_byte)))
        out_blob = _DATA_BLOB()
        if not ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)
        ):
            raise OSError("DPAPI CryptUnprotectData failed")
        out = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)
        return out.decode("utf-8")
    # Legacy plaintext (shouldn't happen, but tolerate)
    return ciphertext


# ─── Config model ─────────────────────────────────────────────────────────────
class Config:
    def __init__(self):
        self.server_url: str = ""
        self.api_key: str = ""

    @property
    def api_url(self) -> str:
        base = self.server_url.rstrip("/")
        return f"{base}/api/attendance/face-checkin"

    @property
    def verify_url(self) -> str:
        base = self.server_url.rstrip("/")
        return f"{base}/api/cv-station/verify"

    def load(self) -> bool:
        if not CONFIG_PATH.exists():
            return False
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
            self.server_url = raw.get("server_url", "")
            enc = raw.get("api_key_enc", "")
            self.api_key = _dpapi_unprotect(enc) if enc else ""
            return bool(self.server_url and self.api_key)
        except Exception as e:
            logging.error(f"Config load failed: {e}")
            return False

    def save(self):
        data = {
            "server_url": self.server_url,
            "api_key_enc": _dpapi_protect(self.api_key) if self.api_key else "",
            "saved_at": datetime.datetime.now().isoformat(),
            "version": APP_VERSION,
        }
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)


CONFIG = Config()


# ─── Windows startup registration ─────────────────────────────────────────────
def _registry_set_startup(enabled: bool) -> bool:
    if sys.platform != "win32":
        return False
    try:
        import winreg
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS) as key:
            if enabled:
                exe_path = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
                winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{exe_path}"')
            else:
                try:
                    winreg.DeleteValue(key, APP_NAME)
                except FileNotFoundError:
                    pass
        return True
    except Exception as e:
        logging.error(f"Registry update failed: {e}")
        return False


def _registry_is_startup_enabled() -> bool:
    if sys.platform != "win32":
        return False
    try:
        import winreg
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0, winreg.KEY_READ,
        ) as key:
            try:
                winreg.QueryValueEx(key, APP_NAME)
                return True
            except FileNotFoundError:
                return False
    except Exception:
        return False


# ─── Palette shared by setup wizard + main app ────────────────────────────────
PALETTE = {
    "bg_dark":        "#1a1a2e",
    "bg_medium":      "#16213e",
    "bg_light":       "#0f3460",
    "accent":         "#e94560",
    "accent_hover":   "#c23b53",
    "success":        "#00ff88",
    "warning":        "#ffa500",
    "error":          "#ff4757",
    "text":           "#ffffff",
    "text_secondary": "#a0a0a0",
}


# ============================================================================
# SETUP WIZARD — shown before main app if config incomplete, or from Settings
# ============================================================================
class SetupWizard:
    """
    Modal wizard that collects Server URL + API Key, verifies end-to-end
    connectivity (web app, API key, Convex, Google Sheets) and persists
    config only when all checks pass.
    """

    CHECKS = [
        ("webApp",       "Web app reachable"),
        ("apiKey",       "API key accepted"),
        ("convex",       "Convex backend reachable"),
        ("googleSheets", "Google Sheets reachable"),
    ]

    def __init__(self, parent: Optional[tk.Tk] = None, initial: Optional[Config] = None):
        self.ok = False
        self.result = Config()
        self._owns_root = parent is None

        self.root = tk.Toplevel(parent) if parent else tk.Tk()
        self.root.title(f"{APP_NAME} — Setup")
        self.root.configure(bg=PALETTE["bg_dark"])
        self.root.geometry("640x620")
        self.root.resizable(False, False)
        if parent:
            self.root.transient(parent)
            self.root.grab_set()

        # ── Header ────────────────────────────────────────
        header = tk.Frame(self.root, bg=PALETTE["bg_medium"], height=80)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(header, text="🛠  CV Station Setup", bg=PALETTE["bg_medium"],
                 fg=PALETTE["text"], font=("Segoe UI", 18, "bold")).pack(side="left", padx=20, pady=18)
        tk.Label(header, text=f"v{APP_VERSION}", bg=PALETTE["bg_medium"],
                 fg=PALETTE["text_secondary"], font=("Segoe UI", 10)).pack(side="right", padx=20)

        body = tk.Frame(self.root, bg=PALETTE["bg_dark"])
        body.pack(fill="both", expand=True, padx=24, pady=16)

        tk.Label(body,
                 text="Enter your server URL and API key, then click 'Test Connection'.\n"
                      "You can only save once all checks pass.",
                 bg=PALETTE["bg_dark"], fg=PALETTE["text_secondary"],
                 font=("Segoe UI", 9), justify="left").pack(anchor="w", pady=(0, 14))

        # ── Server URL ────────────────────────────────────
        tk.Label(body, text="Server URL", bg=PALETTE["bg_dark"],
                 fg=PALETTE["text"], font=("Segoe UI", 10, "bold")).pack(anchor="w")
        self.server_entry = tk.Entry(body, bg=PALETTE["bg_light"], fg=PALETTE["text"],
                                     font=("Segoe UI", 11), relief="flat",
                                     insertbackground=PALETTE["text"])
        self.server_entry.pack(fill="x", ipady=8, pady=(2, 4))
        if initial and initial.server_url:
            self.server_entry.insert(0, initial.server_url)
        else:
            self.server_entry.insert(0, "https://")
        tk.Label(body, text="e.g. https://dict-r5.example.com  (no trailing slash)",
                 bg=PALETTE["bg_dark"], fg=PALETTE["text_secondary"],
                 font=("Segoe UI", 8)).pack(anchor="w", pady=(0, 12))

        # ── API Key ───────────────────────────────────────
        tk.Label(body, text="API Key (FACE_CV_API_KEY)", bg=PALETTE["bg_dark"],
                 fg=PALETTE["text"], font=("Segoe UI", 10, "bold")).pack(anchor="w")
        self.key_entry = tk.Entry(body, bg=PALETTE["bg_light"], fg=PALETTE["text"],
                                  font=("Segoe UI", 11), relief="flat", show="•",
                                  insertbackground=PALETTE["text"])
        self.key_entry.pack(fill="x", ipady=8, pady=(2, 4))
        if initial and initial.api_key:
            self.key_entry.insert(0, initial.api_key)

        show_var = tk.BooleanVar(value=False)
        tk.Checkbutton(body, text="Show key", variable=show_var,
                       bg=PALETTE["bg_dark"], fg=PALETTE["text_secondary"],
                       selectcolor=PALETTE["bg_dark"], activebackground=PALETTE["bg_dark"],
                       activeforeground=PALETTE["text"], font=("Segoe UI", 8),
                       command=lambda: self.key_entry.config(show="" if show_var.get() else "•")
                       ).pack(anchor="w", pady=(0, 12))

        # ── Test button ───────────────────────────────────
        btn_row = tk.Frame(body, bg=PALETTE["bg_dark"])
        btn_row.pack(fill="x", pady=(4, 10))
        self.test_btn = tk.Button(
            btn_row, text="🔌 Test Connection", command=self.run_tests,
            bg=PALETTE["accent"], fg=PALETTE["text"],
            font=("Segoe UI", 10, "bold"), relief="flat", padx=20, pady=10,
            cursor="hand2",
        )
        self.test_btn.pack(side="left")

        # ── Check list ────────────────────────────────────
        self.check_labels: dict[str, tk.Label] = {}
        checks_frame = tk.Frame(body, bg=PALETTE["bg_medium"])
        checks_frame.pack(fill="x", pady=6)
        for key, label in self.CHECKS:
            row = tk.Frame(checks_frame, bg=PALETTE["bg_medium"])
            row.pack(fill="x", padx=12, pady=4)
            dot = tk.Label(row, text="○", bg=PALETTE["bg_medium"],
                           fg=PALETTE["text_secondary"], font=("Segoe UI", 14, "bold"))
            dot.pack(side="left")
            name = tk.Label(row, text=label, bg=PALETTE["bg_medium"],
                            fg=PALETTE["text"], font=("Segoe UI", 10))
            name.pack(side="left", padx=8)
            detail = tk.Label(row, text="not tested", bg=PALETTE["bg_medium"],
                              fg=PALETTE["text_secondary"], font=("Segoe UI", 9),
                              anchor="w")
            detail.pack(side="left", padx=8, fill="x", expand=True)
            self.check_labels[key] = (dot, detail)  # type: ignore

        # ── Footer ────────────────────────────────────────
        footer = tk.Frame(body, bg=PALETTE["bg_dark"])
        footer.pack(fill="x", side="bottom", pady=(16, 0))
        self.save_btn = tk.Button(
            footer, text="💾 Save & Launch", command=self.save_and_close,
            bg=PALETTE["bg_light"], fg=PALETTE["text_secondary"],
            font=("Segoe UI", 10, "bold"), relief="flat", padx=20, pady=10,
            state="disabled", cursor="arrow",
        )
        self.save_btn.pack(side="right")
        tk.Button(footer, text="Cancel", command=self.cancel,
                  bg=PALETTE["bg_medium"], fg=PALETTE["text"],
                  font=("Segoe UI", 10), relief="flat", padx=20, pady=10,
                  cursor="hand2").pack(side="right", padx=(0, 8))

        self.root.protocol("WM_DELETE_WINDOW", self.cancel)

    # ── Check plumbing ────────────────────────────────────
    def _set_check(self, key: str, ok: Optional[bool], message: str):
        dot, detail = self.check_labels[key]  # type: ignore
        if ok is True:
            dot.config(text="✓", fg=PALETTE["success"])
        elif ok is False:
            dot.config(text="✗", fg=PALETTE["error"])
        else:
            dot.config(text="○", fg=PALETTE["text_secondary"])
        detail.config(text=message,
                      fg=(PALETTE["success"] if ok else PALETTE["error"]
                          if ok is False else PALETTE["text_secondary"]))

    def run_tests(self):
        server_url = self.server_entry.get().strip().rstrip("/")
        api_key    = self.key_entry.get().strip()

        if not server_url or server_url == "https:" or not server_url.startswith(("http://", "https://")):
            messagebox.showerror("Invalid URL", "Server URL must start with http:// or https://")
            return
        if not api_key:
            messagebox.showerror("Missing key", "Please enter the API key")
            return

        self.test_btn.config(state="disabled", text="Testing…")
        for k, _ in self.CHECKS:
            self._set_check(k, None, "testing…")
        self.save_btn.config(state="disabled", bg=PALETTE["bg_light"], fg=PALETTE["text_secondary"])

        threading.Thread(target=self._do_tests, args=(server_url, api_key), daemon=True).start()

    def _do_tests(self, server_url: str, api_key: str):
        # 1. Web app reachability — GET on the verify probe
        try:
            r = requests.get(f"{server_url}/api/cv-station/verify", timeout=8)
            if r.status_code == 200:
                self._set_check("webApp", True, f"Reachable ({r.json().get('version', '?')})")
            else:
                self._set_check("webApp", False, f"HTTP {r.status_code}")
                self._finalize(False, server_url, api_key)
                return
        except Exception as e:
            self._set_check("webApp", False, f"Unreachable: {e}")
            self._finalize(False, server_url, api_key)
            return

        # 2/3/4. One POST does all three remaining checks server-side
        try:
            r = requests.post(
                f"{server_url}/api/cv-station/verify",
                json={"apiKey": api_key},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=20,
            )
            data = r.json()
            checks = data.get("checks", {})
            for k in ("apiKey", "convex", "googleSheets"):
                c = checks.get(k) or {"ok": False, "message": "no response"}
                self._set_check(k, bool(c.get("ok")), str(c.get("message", "")))
            self._finalize(bool(data.get("ok")), server_url, api_key)
        except Exception as e:
            for k in ("apiKey", "convex", "googleSheets"):
                self._set_check(k, False, f"request failed: {e}")
            self._finalize(False, server_url, api_key)

    def _finalize(self, all_ok: bool, server_url: str, api_key: str):
        def apply():
            self.test_btn.config(state="normal", text="🔌 Test Connection")
            if all_ok:
                self.result.server_url = server_url
                self.result.api_key    = api_key
                self.save_btn.config(state="normal", bg=PALETTE["success"], fg=PALETTE["bg_dark"],
                                     cursor="hand2")
            else:
                self.save_btn.config(state="disabled", bg=PALETTE["bg_light"],
                                     fg=PALETTE["text_secondary"], cursor="arrow")
        self.root.after(0, apply)

    # ── Lifecycle ──────────────────────────────────────────
    def save_and_close(self):
        try:
            self.result.save()
            self.ok = True
        except Exception as e:
            messagebox.showerror("Save failed", f"Could not write config: {e}")
            return
        self._destroy()

    def cancel(self):
        self.ok = False
        self._destroy()

    def _destroy(self):
        try:
            self.root.grab_release()
        except Exception:
            pass
        self.root.destroy()

    def show(self) -> bool:
        """Blocks until wizard closes. Returns True if user saved valid config."""
        if self._owns_root:
            self.root.mainloop()
        else:
            self.root.wait_window()
        return self.ok


# ============================================================================
# MAIN APP
# ============================================================================
class ModernAttendanceSystem:
    def __init__(self):
        self.setup_logging()

        self.root = tk.Tk()
        self.root.title(f"DICT Region V — Face Recognition Attendance (v{APP_VERSION})")
        self.root.geometry("1400x900")
        self.root.configure(bg=PALETTE["bg_dark"])

        self.setup_modern_styles()
        self.init_face_detection()
        self.init_directories()
        self.init_database()
        self.init_variables()

        self.camera_ready = False
        threading.Thread(target=self.pre_initialize_camera, daemon=True).start()

        self.create_modern_gui()
        self.start_sync_worker()

    # ===== SETUP =====

    def setup_logging(self):
        log_path = _config_dir() / "attendance_system.log"
        logging.basicConfig(
            filename=str(log_path),
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
        )
        self.logger = logging.getLogger(__name__)

    def setup_modern_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        self.colors = PALETTE
        style.configure("TFrame", background=self.colors["bg_dark"])
        style.configure("TLabel", background=self.colors["bg_dark"],
                        foreground=self.colors["text"], font=("Segoe UI", 10))
        style.configure("TNotebook", background=self.colors["bg_dark"], borderwidth=0)
        style.configure("TNotebook.Tab",
                        background=self.colors["bg_medium"],
                        foreground=self.colors["text"],
                        padding=(20, 10), font=("Segoe UI", 10, "bold"))
        style.map("TNotebook.Tab",
                  background=[("selected", self.colors["bg_light"])],
                  foreground=[("selected", self.colors["success"])])

    def init_face_detection(self):
        try:
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            self.recognizer = cv2.face.LBPHFaceRecognizer_create()
            self.logger.info("✓ Face detection initialized")
        except Exception as e:
            self.logger.error(f"Face detection error: {e}")
            messagebox.showerror("Error", "Failed to initialize face detection")

    def init_directories(self):
        # Data goes next to the config (roaming AppData) so an .exe running
        # from Program Files still works without admin rights.
        self.base_dir = _config_dir() / "data"
        self.registered_faces_dir = self.base_dir / "registered_faces"
        self.unknown_faces_dir    = self.base_dir / "unknown_faces"
        for d in [self.base_dir, self.registered_faces_dir, self.unknown_faces_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def init_database(self):
        self.db_path = self.base_dir / "attendance.db"
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                employee_id TEXT UNIQUE,
                department TEXT,
                id_number TEXT,
                convex_intern_id TEXT,
                registration_date TEXT,
                synced INTEGER DEFAULT 0
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT,
                timestamp TEXT,
                date TEXT,
                time TEXT,
                status TEXT,
                action TEXT,
                confidence REAL,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT,
                data TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at TEXT
            )
        ''')

        conn.commit()
        conn.close()

    def init_variables(self):
        self.cap                  = None
        self.processing           = False
        self.current_frame        = None
        self.face_id_counter      = 0
        self.confidence_threshold = 70
        self.name_to_id           = {}
        self.id_to_name           = {}
        self.last_recognition     = {}
        self.recognition_cooldown = 10

        self.load_existing_data()

    def pre_initialize_camera(self):
        try:
            cameras = self.get_available_cameras()
            if cameras:
                test_cap = cv2.VideoCapture(cameras[0], cv2.CAP_DSHOW)
                if test_cap.isOpened():
                    ret, _ = test_cap.read()
                    if ret:
                        self.camera_ready = True
                test_cap.release()
        except Exception as e:
            self.logger.error(f"Camera pre-init error: {e}")

    def load_existing_data(self):
        try:
            conn   = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT id, name FROM users")
            for user_id, name in cursor.fetchall():
                self.id_to_name[user_id] = name
                self.name_to_id[name]    = user_id
            self.face_id_counter = max(self.id_to_name.keys(), default=0) + 1
            conn.close()

            model_file = self.base_dir / "recognizer.yml"
            if model_file.exists():
                self.recognizer.read(str(model_file))
                self.logger.info(f"✓ Loaded {len(self.id_to_name)} users")
        except Exception as e:
            self.logger.error(f"Error loading data: {e}")

    def get_available_cameras(self):
        available = []
        try:
            for i in range(3):
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
                if cap.isOpened():
                    ret, _ = cap.read()
                    if ret:
                        available.append(i)
                cap.release()
        except Exception as e:
            self.logger.error(f"Camera detection error: {e}")
        return available

    # ===== GUI =====

    def create_modern_gui(self):
        self.create_header()
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=5)

        self.register_frame   = self.create_register_tab()
        self.attendance_frame = self.create_attendance_tab()
        self.reports_frame    = self.create_reports_tab()
        self.manage_frame     = self.create_manage_tab()
        self.settings_frame   = self.create_settings_tab()

        self.notebook.add(self.register_frame,   text="📝 Register")
        self.notebook.add(self.attendance_frame, text="👤 Attendance")
        self.notebook.add(self.reports_frame,    text="📊 Reports")
        self.notebook.add(self.manage_frame,     text="👥 Manage")
        self.notebook.add(self.settings_frame,   text="⚙️ Settings")

        self.create_status_bar()

    def create_header(self):
        header = tk.Frame(self.root, bg=self.colors["bg_medium"], height=80)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="🏢 DICT Region V",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 24, "bold")).pack(side="left", padx=20, pady=15)

        tk.Label(header, text="Face Recognition Attendance System",
                 bg=self.colors["bg_medium"], fg=self.colors["text_secondary"],
                 font=("Segoe UI", 12)).pack(side="left", pady=20)

        # Connection indicator — reflects whether we have a working config
        status_color = self.colors["success"] if CONFIG.api_key else self.colors["warning"]
        status_text  = f"● Connected: {CONFIG.server_url}" if CONFIG.api_key else "● Not configured"
        self.connection_indicator = tk.Label(
            header, text=status_text,
            bg=self.colors["bg_medium"], fg=status_color,
            font=("Segoe UI", 10, "bold"),
        )
        self.connection_indicator.pack(side="right", padx=20)

    def create_register_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors["bg_dark"])

        left  = tk.Frame(frame, bg=self.colors["bg_dark"])
        left.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        right = tk.Frame(frame, bg=self.colors["bg_dark"])
        right.pack(side="right", fill="both", expand=True, padx=10, pady=10)

        form = tk.Frame(left, bg=self.colors["bg_medium"])
        form.pack(fill="both", expand=True, padx=5, pady=5)

        tk.Label(form, text="Employee Registration",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 16, "bold")).pack(pady=15)

        self.reg_fields = {}
        for field, _placeholder in [
            ("Name",        "Full Name (must match Convex record)"),
            ("Employee ID", "DICT-26-XX-001"),
            ("ID Number",   "National ID"),
            ("Department",  "Department Name"),
        ]:
            ff = tk.Frame(form, bg=self.colors["bg_medium"])
            ff.pack(fill="x", padx=20, pady=8)
            tk.Label(ff, text=field, bg=self.colors["bg_medium"],
                     fg=self.colors["text"], font=("Segoe UI", 10, "bold")).pack(anchor="w")
            e = tk.Entry(ff, bg=self.colors["bg_light"], fg=self.colors["text"],
                         font=("Segoe UI", 11), relief="flat",
                         insertbackground=self.colors["text"])
            e.pack(fill="x", ipady=8)
            self.reg_fields[field] = e

        ff = tk.Frame(form, bg=self.colors["bg_medium"])
        ff.pack(fill="x", padx=20, pady=8)
        tk.Label(ff, text="Convex Intern ID (optional — for exact match)",
                 bg=self.colors["bg_medium"], fg=self.colors["text_secondary"],
                 font=("Segoe UI", 9)).pack(anchor="w")
        self.convex_id_entry = tk.Entry(
            ff, bg=self.colors["bg_light"], fg=self.colors["text"],
            font=("Segoe UI", 11), relief="flat", insertbackground=self.colors["text"]
        )
        self.convex_id_entry.pack(fill="x", ipady=6)

        self.sample_label = tk.Label(form, text="Ready to capture",
                                     bg=self.colors["bg_medium"],
                                     fg=self.colors["success"],
                                     font=("Segoe UI", 12, "bold"))
        self.sample_label.pack(pady=15)

        btns = tk.Frame(form, bg=self.colors["bg_medium"])
        btns.pack(pady=20)
        self.create_modern_button(btns, "▶ Start Camera",    self.start_registration, self.colors["accent"]).pack(side="left", padx=5)
        self.create_modern_button(btns, "📸 Capture & Train", self.capture_and_train,  self.colors["success"]).pack(side="left", padx=5)
        self.create_modern_button(btns, "⏹ Stop",            self.stop_camera,         self.colors["error"]).pack(side="left", padx=5)

        preview = tk.Frame(right, bg=self.colors["bg_medium"])
        preview.pack(fill="both", expand=True, padx=5, pady=5)
        tk.Label(preview, text="Camera Preview", bg=self.colors["bg_medium"],
                 fg=self.colors["text"], font=("Segoe UI", 14, "bold")).pack(pady=10)
        self.register_preview = tk.Label(preview, bg="#000000",
                                         text="Camera Offline",
                                         fg=self.colors["text_secondary"],
                                         font=("Segoe UI", 16))
        self.register_preview.pack(fill="both", expand=True, padx=10, pady=10)
        return frame

    def create_attendance_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors["bg_dark"])

        left  = tk.Frame(frame, bg=self.colors["bg_dark"])
        left.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        right = tk.Frame(frame, bg=self.colors["bg_dark"], width=350)
        right.pack(side="right", fill="y", padx=10, pady=10)
        right.pack_propagate(False)

        preview = tk.Frame(left, bg=self.colors["bg_medium"])
        preview.pack(fill="both", expand=True, padx=5, pady=5)
        tk.Label(preview, text="🎥 Live Attendance Monitoring",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 16, "bold")).pack(pady=10)

        self.attendance_preview = tk.Label(preview, bg="#000000",
                                           text="Start monitoring to begin",
                                           fg=self.colors["text_secondary"],
                                           font=("Segoe UI", 16))
        self.attendance_preview.pack(fill="both", expand=True, padx=10, pady=10)

        self.recognition_label = tk.Label(preview, text="No one detected",
                                          bg=self.colors["bg_medium"],
                                          fg=self.colors["text"],
                                          font=("Segoe UI", 18, "bold"))
        self.recognition_label.pack(pady=15)

        btns = tk.Frame(preview, bg=self.colors["bg_medium"])
        btns.pack(pady=15)
        self.create_modern_button(btns, "▶ Start Monitoring", self.start_attendance_monitoring, self.colors["success"]).pack(side="left", padx=5)
        self.create_modern_button(btns, "⏹ Stop",             self.stop_camera,                  self.colors["error"]).pack(side="left", padx=5)

        activity = tk.Frame(right, bg=self.colors["bg_medium"])
        activity.pack(fill="both", expand=True, padx=5, pady=5)
        tk.Label(activity, text="📋 Recent Activity",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 12, "bold")).pack(pady=10)

        sb = tk.Scrollbar(activity)
        sb.pack(side="right", fill="y")
        self.activity_list = tk.Listbox(activity, bg=self.colors["bg_dark"],
                                        fg=self.colors["text"], font=("Consolas", 9),
                                        yscrollcommand=sb.set, borderwidth=0,
                                        highlightthickness=0,
                                        selectbackground=self.colors["accent"])
        self.activity_list.pack(fill="both", expand=True, padx=5, pady=5)
        sb.config(command=self.activity_list.yview)
        return frame

    def create_reports_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors["bg_dark"])

        ctrl = tk.Frame(frame, bg=self.colors["bg_medium"])
        ctrl.pack(fill="x", padx=10, pady=10)
        tk.Label(ctrl, text="📊 Attendance Reports",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 16, "bold")).pack(pady=10)

        dates = tk.Frame(ctrl, bg=self.colors["bg_medium"])
        dates.pack(pady=10)
        for col, (lbl, attr) in enumerate([("From:", "from_date"), ("To:", "to_date")]):
            tk.Label(dates, text=lbl, bg=self.colors["bg_medium"],
                     fg=self.colors["text"], font=("Segoe UI", 10, "bold")).grid(row=0, column=col*2, padx=5)
            e = tk.Entry(dates, bg=self.colors["bg_light"], fg=self.colors["text"],
                         font=("Segoe UI", 10), width=15)
            e.insert(0, datetime.date.today().strftime("%Y-%m-%d"))
            e.grid(row=0, column=col*2+1, padx=5)
            setattr(self, attr, e)

        btns = tk.Frame(ctrl, bg=self.colors["bg_medium"])
        btns.pack(pady=10)
        self.create_modern_button(btns, "📈 Generate Report", self.generate_report, self.colors["accent"]).pack(side="left", padx=5)
        self.create_modern_button(btns, "💾 Export CSV",      self.export_to_csv,   self.colors["success"]).pack(side="left", padx=5)

        table_frame = tk.Frame(frame, bg=self.colors["bg_medium"])
        table_frame.pack(fill="both", expand=True, padx=10, pady=10)

        style = ttk.Style()
        style.configure("Modern.Treeview",
                        background=self.colors["bg_dark"],
                        foreground=self.colors["text"],
                        fieldbackground=self.colors["bg_dark"], borderwidth=0)
        style.map("Modern.Treeview", background=[("selected", self.colors["accent"])])

        cols = ("Name", "Date", "Time", "Action", "Confidence", "Synced")
        self.report_tree = ttk.Treeview(table_frame, columns=cols,
                                        show="headings", style="Modern.Treeview")
        for c in cols:
            self.report_tree.heading(c, text=c)
            self.report_tree.column(c, width=160)

        sb = ttk.Scrollbar(table_frame, orient="vertical", command=self.report_tree.yview)
        self.report_tree.configure(yscrollcommand=sb.set)
        self.report_tree.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        sb.pack(side="right", fill="y")
        return frame

    def create_manage_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors["bg_dark"])

        hdr = tk.Frame(frame, bg=self.colors["bg_medium"])
        hdr.pack(fill="x", padx=10, pady=10)
        tk.Label(hdr, text="👥 Manage Registered Users",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 16, "bold")).pack(pady=10)

        btns = tk.Frame(hdr, bg=self.colors["bg_medium"])
        btns.pack(pady=10)
        self.create_modern_button(btns, "🔄 Refresh",        self.refresh_user_list, self.colors["accent"]).pack(side="left", padx=5)
        self.create_modern_button(btns, "🗑️ Delete Selected", self.delete_user,       self.colors["error"]).pack(side="left", padx=5)

        table_frame = tk.Frame(frame, bg=self.colors["bg_medium"])
        table_frame.pack(fill="both", expand=True, padx=10, pady=10)

        cols = ("ID", "Name", "Employee ID", "Department", "Convex ID", "Reg. Date")
        self.user_tree = ttk.Treeview(table_frame, columns=cols,
                                      show="headings", style="Modern.Treeview")
        for c in cols:
            self.user_tree.heading(c, text=c)
            self.user_tree.column(c, width=140)

        sb = ttk.Scrollbar(table_frame, orient="vertical", command=self.user_tree.yview)
        self.user_tree.configure(yscrollcommand=sb.set)
        self.user_tree.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        sb.pack(side="right", fill="y")

        self.refresh_user_list()
        return frame

    def create_settings_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors["bg_dark"])

        hdr = tk.Frame(frame, bg=self.colors["bg_medium"])
        hdr.pack(fill="x", padx=10, pady=10)
        tk.Label(hdr, text="⚙️ Settings",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 16, "bold")).pack(pady=10)

        # ── Connection ────────────────────────────────────
        conn_box = tk.LabelFrame(frame, text="Connection", bg=self.colors["bg_medium"],
                                 fg=self.colors["text"], font=("Segoe UI", 10, "bold"),
                                 bd=0, padx=15, pady=15)
        conn_box.pack(fill="x", padx=10, pady=8)

        self.settings_server_label = tk.Label(
            conn_box, text=f"Server URL: {CONFIG.server_url or '(not set)'}",
            bg=self.colors["bg_medium"], fg=self.colors["text"],
            font=("Segoe UI", 10), anchor="w", justify="left",
        )
        self.settings_server_label.pack(anchor="w", pady=2)

        key_display = ("•" * 8 + CONFIG.api_key[-4:]) if CONFIG.api_key else "(not set)"
        self.settings_key_label = tk.Label(
            conn_box, text=f"API Key: {key_display}",
            bg=self.colors["bg_medium"], fg=self.colors["text"],
            font=("Consolas", 10), anchor="w",
        )
        self.settings_key_label.pack(anchor="w", pady=2)

        tk.Label(conn_box, text=f"Config file: {CONFIG_PATH}",
                 bg=self.colors["bg_medium"], fg=self.colors["text_secondary"],
                 font=("Segoe UI", 8), anchor="w").pack(anchor="w", pady=(6, 0))

        btns = tk.Frame(conn_box, bg=self.colors["bg_medium"])
        btns.pack(anchor="w", pady=10)
        self.create_modern_button(btns, "✏ Reconfigure…",   self.reconfigure,       self.colors["accent"]).pack(side="left", padx=(0, 6))
        self.create_modern_button(btns, "🔌 Test Connection", self.test_from_settings, self.colors["bg_light"]).pack(side="left", padx=6)

        # ── Startup ───────────────────────────────────────
        start_box = tk.LabelFrame(frame, text="Startup", bg=self.colors["bg_medium"],
                                  fg=self.colors["text"], font=("Segoe UI", 10, "bold"),
                                  bd=0, padx=15, pady=15)
        start_box.pack(fill="x", padx=10, pady=8)

        self.startup_var = tk.BooleanVar(value=_registry_is_startup_enabled())
        chk = tk.Checkbutton(
            start_box,
            text="  Run on Windows startup (launches this app when user signs in)",
            variable=self.startup_var, command=self._toggle_startup,
            bg=self.colors["bg_medium"], fg=self.colors["text"],
            selectcolor=self.colors["bg_dark"],
            activebackground=self.colors["bg_medium"],
            activeforeground=self.colors["text"],
            font=("Segoe UI", 10),
        )
        chk.pack(anchor="w")

        tk.Label(start_box,
                 text="Registers the .exe under HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.\n"
                      "Only affects the current Windows user.",
                 bg=self.colors["bg_medium"], fg=self.colors["text_secondary"],
                 font=("Segoe UI", 8), justify="left").pack(anchor="w", pady=(6, 0))

        # ── About ─────────────────────────────────────────
        about_box = tk.LabelFrame(frame, text="About", bg=self.colors["bg_medium"],
                                  fg=self.colors["text"], font=("Segoe UI", 10, "bold"),
                                  bd=0, padx=15, pady=15)
        about_box.pack(fill="x", padx=10, pady=8)
        tk.Label(about_box,
                 text=f"{APP_NAME} v{APP_VERSION}\nDICT Region V — Face Recognition Attendance",
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 10), justify="left").pack(anchor="w")

        return frame

    def create_status_bar(self):
        sf = tk.Frame(self.root, bg=self.colors["bg_medium"], height=35)
        sf.pack(fill="x", side="bottom")
        sf.pack_propagate(False)

        self.status_var = tk.StringVar(value="✓ System ready")
        tk.Label(sf, textvariable=self.status_var,
                 bg=self.colors["bg_medium"], fg=self.colors["text"],
                 font=("Segoe UI", 9), anchor="w").pack(side="left", padx=10, fill="x", expand=True)

        self.clock_label = tk.Label(sf, bg=self.colors["bg_medium"],
                                    fg=self.colors["text_secondary"],
                                    font=("Segoe UI", 9))
        self.clock_label.pack(side="right", padx=10)
        self.update_clock()

    def create_modern_button(self, parent, text, command, color):
        btn = tk.Button(parent, text=text, command=command,
                        bg=color, fg=self.colors["text"],
                        font=("Segoe UI", 10, "bold"), relief="flat",
                        borderwidth=0, padx=20, pady=10, cursor="hand2",
                        activebackground=color, activeforeground=self.colors["text"])
        btn.bind("<Enter>", lambda e: btn.config(bg=self._adjust_color(color, -20)))
        btn.bind("<Leave>", lambda e: btn.config(bg=color))
        return btn

    def _adjust_color(self, hex_color, amount):
        h = hex_color.lstrip("#")
        rgb = tuple(max(0, min(255, int(h[i:i+2], 16) + amount)) for i in (0, 2, 4))
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

    def update_clock(self):
        self.clock_label.config(text=datetime.datetime.now().strftime("%I:%M:%S %p • %B %d, %Y"))
        self.root.after(1000, self.update_clock)

    # ===== Settings actions =====

    def reconfigure(self):
        wizard = SetupWizard(parent=self.root, initial=CONFIG)
        if wizard.show():
            CONFIG.server_url = wizard.result.server_url
            CONFIG.api_key    = wizard.result.api_key
            self._refresh_connection_indicator()
            self.settings_server_label.config(text=f"Server URL: {CONFIG.server_url}")
            self.settings_key_label.config(text=f"API Key: {'•' * 8}{CONFIG.api_key[-4:]}")
            self.status_var.set("✓ Configuration updated")

    def test_from_settings(self):
        if not CONFIG.server_url or not CONFIG.api_key:
            messagebox.showwarning("Not configured", "Set the server URL and API key first.")
            return
        self.status_var.set("Testing connection…")
        def run():
            try:
                r = requests.post(
                    CONFIG.verify_url,
                    json={"apiKey": CONFIG.api_key},
                    headers={"Authorization": f"Bearer {CONFIG.api_key}"},
                    timeout=20,
                )
                data = r.json()
                def show():
                    if data.get("ok"):
                        messagebox.showinfo("Connection OK", "All checks passed.")
                        self.status_var.set("✓ Connection verified")
                    else:
                        failed = [k for k, v in data.get("checks", {}).items()
                                  if not v.get("ok")]
                        messagebox.showerror("Connection failed", f"Failed: {', '.join(failed) or 'unknown'}")
                        self.status_var.set("⚠ Connection test failed")
                self.root.after(0, show)
            except Exception as e:
                self.root.after(0, lambda: messagebox.showerror("Error", str(e)))
        threading.Thread(target=run, daemon=True).start()

    def _toggle_startup(self):
        enabled = self.startup_var.get()
        ok = _registry_set_startup(enabled)
        if not ok:
            messagebox.showerror("Error", "Could not update Windows startup registry")
            self.startup_var.set(_registry_is_startup_enabled())
            return
        self.status_var.set("✓ Startup " + ("enabled" if enabled else "disabled"))

    def _refresh_connection_indicator(self):
        self.connection_indicator.config(
            text=f"● Connected: {CONFIG.server_url}",
            fg=self.colors["success"],
        )

    # ===== CAMERA =====

    def _open_camera(self):
        cameras = self.get_available_cameras()
        if not cameras:
            messagebox.showerror("Error", "No camera found")
            return False
        self.cap = cv2.VideoCapture(cameras[0], cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            messagebox.showerror("Error", "Failed to open camera")
            return False
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS,          30)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE,   1)
        return True

    def start_registration(self):
        if self.cap is None:
            if not self._open_camera():
                return
            self.processing = True
            self.status_var.set("✓ Camera started")
            threading.Thread(target=self.registration_preview_loop, daemon=True).start()

    def registration_preview_loop(self):
        while self.processing and self.cap is not None:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.01)
                continue
            frame = cv2.flip(frame, 1)
            gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
            for (x, y, w, h) in faces:
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                cv2.putText(frame, "Face Detected", (x, y-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            self.display_frame(frame, self.register_preview)
            self.current_frame = frame

    def capture_and_train(self):
        if not self.cap:
            messagebox.showerror("Error", "Camera not started")
            return

        name        = self.reg_fields["Name"].get().strip()
        employee_id = self.reg_fields["Employee ID"].get().strip()
        convex_id   = self.convex_id_entry.get().strip() or None

        if not name:
            messagebox.showerror("Error", "Please enter a name")
            return
        if name in self.name_to_id:
            messagebox.showerror("Error", "Name already registered")
            return

        try:
            conn   = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO users (name, employee_id, department, id_number,
                                   convex_intern_id, registration_date)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                name, employee_id,
                self.reg_fields["Department"].get(),
                self.reg_fields["ID Number"].get(),
                convex_id,
                datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))
            conn.commit()
            user_id = cursor.lastrowid
            conn.close()

            self.name_to_id[name]    = user_id
            self.id_to_name[user_id] = name

        except sqlite3.IntegrityError:
            messagebox.showerror("Error", "Name or Employee ID already exists")
            return

        samples_needed = 30
        samples_taken  = 0
        face_samples   = []
        face_ids       = []

        self.status_var.set(f"Capturing samples: 0/{samples_needed}")

        while samples_taken < samples_needed:
            ret, frame = self.cap.read()
            if not ret:
                continue
            frame = cv2.flip(frame, 1)
            gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)

            for (x, y, w, h) in faces:
                face_img = cv2.resize(gray[y:y+h, x:x+w], (200, 200))
                face_samples.append(face_img)
                face_ids.append(user_id)
                samples_taken += 1
                cv2.imwrite(str(self.registered_faces_dir / f"{name}_sample_{samples_taken}.jpg"), face_img)
                self.sample_label.config(text=f"Samples: {samples_taken}/{samples_needed}")
                self.status_var.set(f"Capturing: {samples_taken}/{samples_needed}")
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                cv2.putText(frame, f"{samples_taken}/{samples_needed}",
                            (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)
                self.display_frame(frame, self.register_preview)
                self.root.update()
                time.sleep(0.1)
                if samples_taken >= samples_needed:
                    break

        if face_samples:
            self.train_model()
            messagebox.showinfo("Success", f"✓ Registered {name}")
            self.status_var.set(f"✓ Registration complete: {name}")
            self.sample_label.config(text="Ready to capture")
            for f in self.reg_fields.values():
                f.delete(0, tk.END)
            self.convex_id_entry.delete(0, tk.END)
            self.refresh_user_list()

    def train_model(self):
        face_samples, face_ids = [], []
        for img_path in self.registered_faces_dir.glob("*.jpg"):
            img  = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
            name = img_path.stem.split("_sample_")[0]
            if name in self.name_to_id:
                face_samples.append(img)
                face_ids.append(self.name_to_id[name])
        if face_samples:
            self.recognizer.train(face_samples, np.array(face_ids))
            self.recognizer.write(str(self.base_dir / "recognizer.yml"))
            self.logger.info("✓ Model trained")

    def start_attendance_monitoring(self):
        if self.cap is None:
            if not self._open_camera():
                return
            self.processing = True
            self.status_var.set("✓ Monitoring started")
            threading.Thread(target=self.attendance_monitoring_loop, daemon=True).start()

    def attendance_monitoring_loop(self):
        while self.processing and self.cap is not None:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.01)
                continue

            frame = cv2.flip(frame, 1)
            gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)

            for (x, y, w, h) in faces:
                face_img = cv2.resize(gray[y:y+h, x:x+w], (200, 200))
                try:
                    label, raw_confidence = self.recognizer.predict(face_img)
                    confidence_score = max(0.0, 1.0 - raw_confidence / 100.0)

                    if raw_confidence < self.confidence_threshold:
                        name      = self.id_to_name.get(label, "Unknown")
                        box_color = (0, 255, 0)
                        self.mark_attendance(label, name, confidence_score)
                        self.recognition_label.config(
                            text=f"✓ {name} ({int(confidence_score * 100)}%)",
                            fg=self.colors["success"],
                        )
                    else:
                        name      = "Unknown"
                        box_color = (0, 0, 255)
                        self.recognition_label.config(
                            text="⚠ Unknown Person",
                            fg=self.colors["warning"],
                        )
                        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                        cv2.imwrite(str(self.unknown_faces_dir / f"unknown_{ts}.jpg"),
                                    frame[y:y+h, x:x+w])

                    cv2.rectangle(frame, (x, y), (x+w, y+h), box_color, 2)
                    cv2.rectangle(frame, (x, y-35), (x+w, y), box_color, cv2.FILLED)
                    label_text = f"{name} {int(confidence_score*100)}%" if name != "Unknown" else "Unknown"
                    cv2.putText(frame, label_text, (x+6, y-6),
                                cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)
                except Exception as e:
                    self.logger.error(f"Recognition error: {e}")

            self.display_frame(frame, self.attendance_preview)

    def stop_camera(self):
        self.processing = False
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.recognition_label.config(text="Camera stopped", fg=self.colors["text_secondary"])
        self.status_var.set("Camera stopped")

    def display_frame(self, frame, widget):
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        photo = ImageTk.PhotoImage(image)
        widget.configure(image=photo, text="")
        widget.image = photo

    # ===== ATTENDANCE =====

    def mark_attendance(self, user_id: int, name: str, confidence: float):
        current_time = datetime.datetime.now()

        if name in self.last_recognition:
            if (current_time - self.last_recognition[name]).total_seconds() < self.recognition_cooldown:
                return

        action = "timeIn" if current_time.hour < 12 else "timeOut"
        status = "Time In" if action == "timeIn" else "Time Out"

        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT convex_intern_id FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        convex_intern_id = row[0] if row else None

        cursor.execute('''
            INSERT INTO attendance (user_id, name, timestamp, date, time, status, action, confidence, synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ''', (
            user_id, name,
            current_time.strftime("%Y-%m-%d %H:%M:%S"),
            current_time.strftime("%Y-%m-%d"),
            current_time.strftime("%H:%M:%S"),
            status, action, round(confidence, 4)
        ))
        att_id = cursor.lastrowid
        conn.commit()
        conn.close()

        synced = self.sync_to_backend(
            intern_id=convex_intern_id,
            intern_name=name,
            action=action,
            confidence=confidence,
            timestamp=current_time,
        )

        self.last_recognition[name] = current_time

        sync_marker = "✓ Synced" if synced else "⚠ Local"
        self.status_var.set(f"✓ {name} — {status} | {int(confidence*100)}% conf | {sync_marker}")
        self.logger.info(f"Attendance: {name} — {status} @ {current_time} (conf={confidence:.2f})")

        if synced:
            conn   = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("UPDATE attendance SET synced = 1 WHERE id = ?", (att_id,))
            conn.commit()
            conn.close()

        log_entry = f"[{current_time.strftime('%H:%M:%S')}] {name} — {status} {int(confidence*100)}% {sync_marker}"
        self.activity_list.insert(0, log_entry)
        if self.activity_list.size() > 50:
            self.activity_list.delete(50, tk.END)

        if not synced:
            self._queue_sync(att_id, convex_intern_id, name, action, confidence, current_time)

    # ===== BACKEND SYNC =====

    def sync_to_backend(
        self,
        intern_id: Optional[str],
        intern_name: str,
        action: str,
        confidence: float,
        timestamp: datetime.datetime,
    ) -> bool:
        if not CONFIG.api_key or not CONFIG.server_url:
            self.logger.warning("Sync skipped — no server/API key configured")
            return False
        try:
            payload = {
                "action":        action,
                "confidence":    round(confidence, 4),
                "isoTimestamp":  timestamp.isoformat(),
            }
            if intern_id:
                payload["internId"]   = intern_id
            else:
                payload["internName"] = intern_name

            headers = {
                "Content-Type":  "application/json",
                "Authorization": f"Bearer {CONFIG.api_key}",
            }

            resp = requests.post(CONFIG.api_url, json=payload, headers=headers, timeout=8)

            if resp.status_code == 200:
                data = resp.json()
                self.logger.info(
                    f"✓ Synced: {data.get('internName', intern_name)} — {data.get('action')}"
                )
                return True
            elif resp.status_code == 409:
                self.logger.warning(f"Sync skipped (409): {resp.text}")
                return True
            else:
                self.logger.error(f"Sync failed {resp.status_code}: {resp.text}")
                return False

        except requests.exceptions.Timeout:
            self.logger.error("Sync timeout — will retry later")
            return False
        except Exception as e:
            self.logger.error(f"Sync error: {e}")
            return False

    def _queue_sync(self, att_id, convex_intern_id, name, action, confidence, timestamp):
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        data   = json.dumps({
            "att_id":        att_id,
            "intern_id":     convex_intern_id,
            "intern_name":   name,
            "action":        action,
            "confidence":    confidence,
            "iso_timestamp": timestamp.isoformat(),
        })
        cursor.execute(
            "INSERT INTO sync_queue (type, data, created_at) VALUES ('face_checkin', ?, ?)",
            (data, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        conn.commit()
        conn.close()

    def start_sync_worker(self):
        def worker():
            while True:
                time.sleep(60)
                self._process_sync_queue()
        threading.Thread(target=worker, daemon=True).start()

    def _process_sync_queue(self):
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, data, retry_count FROM sync_queue WHERE retry_count < 5 LIMIT 10"
        )
        items = cursor.fetchall()
        conn.close()

        for item_id, data_json, retry_count in items:
            d = json.loads(data_json)
            ts = datetime.datetime.fromisoformat(d["iso_timestamp"])
            ok = self.sync_to_backend(
                intern_id=d.get("intern_id"),
                intern_name=d["intern_name"],
                action=d["action"],
                confidence=d["confidence"],
                timestamp=ts,
            )
            conn   = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            if ok:
                cursor.execute("DELETE FROM sync_queue WHERE id = ?", (item_id,))
                cursor.execute("UPDATE attendance SET synced = 1 WHERE id = ?", (d["att_id"],))
            else:
                cursor.execute(
                    "UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?",
                    (item_id,)
                )
            conn.commit()
            conn.close()

    # ===== REPORTS =====

    def generate_report(self):
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT name, date, time, action, confidence, synced FROM attendance
            WHERE date BETWEEN ? AND ?
            ORDER BY date DESC, time DESC
        ''', (self.from_date.get(), self.to_date.get()))
        records = cursor.fetchall()
        conn.close()

        for item in self.report_tree.get_children():
            self.report_tree.delete(item)

        for r in records:
            name, date, t, action, conf, synced = r
            conf_str   = f"{int((conf or 0)*100)}%" if conf else "—"
            synced_str = "✓" if synced else "pending"
            self.report_tree.insert("", "end", values=(name, date, t, action, conf_str, synced_str))

        self.status_var.set(f"✓ Report: {len(records)} records")

    def export_to_csv(self):
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT name, date, time, action, confidence, synced FROM attendance
            WHERE date BETWEEN ? AND ?
            ORDER BY date DESC, time DESC
        ''', (self.from_date.get(), self.to_date.get()))
        records = cursor.fetchall()
        conn.close()

        if not records:
            messagebox.showwarning("Warning", "No records to export")
            return

        ts       = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = self.base_dir / f"report_{ts}.csv"
        with open(csv_path, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["Name", "Date", "Time", "Action", "Confidence", "Synced"])
            w.writerows(records)

        messagebox.showinfo("Success", f"✓ Exported to:\n{csv_path}")
        self.status_var.set(f"✓ Exported: {csv_path.name}")

    # ===== USER MANAGEMENT =====

    def refresh_user_list(self):
        for item in self.user_tree.get_children():
            self.user_tree.delete(item)
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, employee_id, department, convex_intern_id, registration_date FROM users"
        )
        for u in cursor.fetchall():
            self.user_tree.insert("", "end", values=u)
        conn.close()

    def delete_user(self):
        sel = self.user_tree.selection()
        if not sel:
            messagebox.showwarning("Warning", "Please select a user")
            return
        if messagebox.askyesno("Confirm", "Delete selected user?"):
            item    = self.user_tree.item(sel[0])
            user_id = item["values"][0]
            name    = item["values"][1]
            conn   = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            conn.close()
            self.id_to_name.pop(user_id, None)
            self.name_to_id.pop(name, None)
            self.train_model()
            self.refresh_user_list()
            self.status_var.set(f"✓ Deleted: {name}")

    # ===== MAIN =====

    def run(self):
        self.root.mainloop()
        self.cleanup()

    def cleanup(self):
        self.processing = False
        if self.cap is not None:
            self.cap.release()
        cv2.destroyAllWindows()


# ============================================================================
# ENTRY POINT
# ============================================================================
def main():
    # Bring up setup wizard first if config is missing/incomplete.
    if not CONFIG.load():
        wizard = SetupWizard(parent=None)
        if not wizard.show():
            sys.exit(0)
        CONFIG.server_url = wizard.result.server_url
        CONFIG.api_key    = wizard.result.api_key

    app = ModernAttendanceSystem()
    app.run()


if __name__ == "__main__":
    main()
