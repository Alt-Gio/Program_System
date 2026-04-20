import cv2
import numpy as np
import os
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

# ─── Configuration ────────────────────────────────────────────────────────────
# URL of your deployed Next.js app (or http://localhost:3000 for local dev)
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000")
API_URL      = f"{API_BASE_URL}/api/attendance/face-checkin"

# Set FACE_CV_API_KEY in your .env (same value as in Next.js .env.local)
API_KEY = os.getenv("FACE_CV_API_KEY", "")


class ModernAttendanceSystem:
    def __init__(self):
        self.setup_logging()

        self.root = tk.Tk()
        self.root.title("DICT Region V - Face Recognition Attendance")
        self.root.geometry("1400x900")
        self.root.configure(bg='#1a1a2e')

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
        logging.basicConfig(
            filename='attendance_system.log',
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def setup_modern_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        self.colors = {
            'bg_dark':        '#1a1a2e',
            'bg_medium':      '#16213e',
            'bg_light':       '#0f3460',
            'accent':         '#e94560',
            'accent_hover':   '#c23b53',
            'success':        '#00ff88',
            'warning':        '#ffa500',
            'error':          '#ff4757',
            'text':           '#ffffff',
            'text_secondary': '#a0a0a0',
        }
        style.configure('TFrame', background=self.colors['bg_dark'])
        style.configure('TLabel', background=self.colors['bg_dark'],
                        foreground=self.colors['text'], font=('Segoe UI', 10))
        style.configure('TNotebook', background=self.colors['bg_dark'], borderwidth=0)
        style.configure('TNotebook.Tab',
                        background=self.colors['bg_medium'],
                        foreground=self.colors['text'],
                        padding=(20, 10), font=('Segoe UI', 10, 'bold'))
        style.map('TNotebook.Tab',
                  background=[('selected', self.colors['bg_light'])],
                  foreground=[('selected', self.colors['success'])])

    def init_face_detection(self):
        try:
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            self.recognizer = cv2.face.LBPHFaceRecognizer_create()
            self.logger.info("✓ Face detection initialized")
        except Exception as e:
            self.logger.error(f"Face detection error: {e}")
            messagebox.showerror("Error", "Failed to initialize face detection")

    def init_directories(self):
        self.base_dir = Path("attendance_data")
        self.registered_faces_dir = self.base_dir / "registered_faces"
        self.unknown_faces_dir    = self.base_dir / "unknown_faces"
        for d in [self.base_dir, self.registered_faces_dir, self.unknown_faces_dir]:
            d.mkdir(exist_ok=True)

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
        self.recognition_cooldown = 10  # seconds

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
        self.notebook.pack(fill='both', expand=True, padx=10, pady=5)

        self.register_frame   = self.create_register_tab()
        self.attendance_frame = self.create_attendance_tab()
        self.reports_frame    = self.create_reports_tab()
        self.manage_frame     = self.create_manage_tab()

        self.notebook.add(self.register_frame,   text='📝 Register')
        self.notebook.add(self.attendance_frame, text='👤 Attendance')
        self.notebook.add(self.reports_frame,    text='📊 Reports')
        self.notebook.add(self.manage_frame,     text='⚙️ Manage')

        self.create_status_bar()

    def create_header(self):
        header = tk.Frame(self.root, bg=self.colors['bg_medium'], height=80)
        header.pack(fill='x')
        header.pack_propagate(False)

        tk.Label(header, text="🏢 DICT Region V",
                 bg=self.colors['bg_medium'], fg=self.colors['text'],
                 font=('Segoe UI', 24, 'bold')).pack(side='left', padx=20, pady=15)

        tk.Label(header, text="Face Recognition Attendance System",
                 bg=self.colors['bg_medium'], fg=self.colors['text_secondary'],
                 font=('Segoe UI', 12)).pack(side='left', pady=20)

        status_color = self.colors['success'] if API_KEY else self.colors['warning']
        status_text  = "● API Ready" if API_KEY else "● No API Key (open mode)"
        self.connection_indicator = tk.Label(
            header, text=status_text,
            bg=self.colors['bg_medium'], fg=status_color,
            font=('Segoe UI', 11, 'bold')
        )
        self.connection_indicator.pack(side='right', padx=20)

    def create_register_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors['bg_dark'])

        left  = tk.Frame(frame, bg=self.colors['bg_dark'])
        left.pack(side='left', fill='both', expand=True, padx=10, pady=10)
        right = tk.Frame(frame, bg=self.colors['bg_dark'])
        right.pack(side='right', fill='both', expand=True, padx=10, pady=10)

        form = tk.Frame(left, bg=self.colors['bg_medium'])
        form.pack(fill='both', expand=True, padx=5, pady=5)

        tk.Label(form, text="Employee Registration",
                 bg=self.colors['bg_medium'], fg=self.colors['text'],
                 font=('Segoe UI', 16, 'bold')).pack(pady=15)

        self.reg_fields = {}
        for field, placeholder in [
            ('Name',        'Full Name (must match Convex record)'),
            ('Employee ID', 'DICT-26-XX-001'),
            ('ID Number',   'National ID'),
            ('Department',  'Department Name'),
        ]:
            ff = tk.Frame(form, bg=self.colors['bg_medium'])
            ff.pack(fill='x', padx=20, pady=8)
            tk.Label(ff, text=field, bg=self.colors['bg_medium'],
                     fg=self.colors['text'], font=('Segoe UI', 10, 'bold')).pack(anchor='w')
            e = tk.Entry(ff, bg=self.colors['bg_light'], fg=self.colors['text'],
                         font=('Segoe UI', 11), relief='flat',
                         insertbackground=self.colors['text'])
            e.pack(fill='x', ipady=8)
            self.reg_fields[field] = e

        # Optional: Convex intern ID field for precise lookup
        ff = tk.Frame(form, bg=self.colors['bg_medium'])
        ff.pack(fill='x', padx=20, pady=8)
        tk.Label(ff, text="Convex Intern ID (optional — for exact match)",
                 bg=self.colors['bg_medium'], fg=self.colors['text_secondary'],
                 font=('Segoe UI', 9)).pack(anchor='w')
        self.convex_id_entry = tk.Entry(
            ff, bg=self.colors['bg_light'], fg=self.colors['text'],
            font=('Segoe UI', 11), relief='flat', insertbackground=self.colors['text']
        )
        self.convex_id_entry.pack(fill='x', ipady=6)

        self.sample_label = tk.Label(form, text="Ready to capture",
                                     bg=self.colors['bg_medium'],
                                     fg=self.colors['success'],
                                     font=('Segoe UI', 12, 'bold'))
        self.sample_label.pack(pady=15)

        btns = tk.Frame(form, bg=self.colors['bg_medium'])
        btns.pack(pady=20)
        self.create_modern_button(btns, "▶ Start Camera",    self.start_registration,  self.colors['accent']).pack(side='left', padx=5)
        self.create_modern_button(btns, "📸 Capture & Train", self.capture_and_train,   self.colors['success']).pack(side='left', padx=5)
        self.create_modern_button(btns, "⏹ Stop",            self.stop_camera,          self.colors['error']).pack(side='left', padx=5)

        preview = tk.Frame(right, bg=self.colors['bg_medium'])
        preview.pack(fill='both', expand=True, padx=5, pady=5)
        tk.Label(preview, text="Camera Preview", bg=self.colors['bg_medium'],
                 fg=self.colors['text'], font=('Segoe UI', 14, 'bold')).pack(pady=10)
        self.register_preview = tk.Label(preview, bg='#000000',
                                         text="Camera Offline",
                                         fg=self.colors['text_secondary'],
                                         font=('Segoe UI', 16))
        self.register_preview.pack(fill='both', expand=True, padx=10, pady=10)
        return frame

    def create_attendance_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors['bg_dark'])

        left  = tk.Frame(frame, bg=self.colors['bg_dark'])
        left.pack(side='left', fill='both', expand=True, padx=10, pady=10)
        right = tk.Frame(frame, bg=self.colors['bg_dark'], width=350)
        right.pack(side='right', fill='y', padx=10, pady=10)
        right.pack_propagate(False)

        preview = tk.Frame(left, bg=self.colors['bg_medium'])
        preview.pack(fill='both', expand=True, padx=5, pady=5)
        tk.Label(preview, text="🎥 Live Attendance Monitoring",
                 bg=self.colors['bg_medium'], fg=self.colors['text'],
                 font=('Segoe UI', 16, 'bold')).pack(pady=10)

        self.attendance_preview = tk.Label(preview, bg='#000000',
                                           text="Start monitoring to begin",
                                           fg=self.colors['text_secondary'],
                                           font=('Segoe UI', 16))
        self.attendance_preview.pack(fill='both', expand=True, padx=10, pady=10)

        self.recognition_label = tk.Label(preview, text="No one detected",
                                          bg=self.colors['bg_medium'],
                                          fg=self.colors['text'],
                                          font=('Segoe UI', 18, 'bold'))
        self.recognition_label.pack(pady=15)

        btns = tk.Frame(preview, bg=self.colors['bg_medium'])
        btns.pack(pady=15)
        self.create_modern_button(btns, "▶ Start Monitoring", self.start_attendance_monitoring, self.colors['success']).pack(side='left', padx=5)
        self.create_modern_button(btns, "⏹ Stop",             self.stop_camera,                 self.colors['error']).pack(side='left', padx=5)

        activity = tk.Frame(right, bg=self.colors['bg_medium'])
        activity.pack(fill='both', expand=True, padx=5, pady=5)
        tk.Label(activity, text="📋 Recent Activity",
                 bg=self.colors['bg_medium'], fg=self.colors['text'],
                 font=('Segoe UI', 12, 'bold')).pack(pady=10)

        sb = tk.Scrollbar(activity)
        sb.pack(side='right', fill='y')
        self.activity_list = tk.Listbox(activity, bg=self.colors['bg_dark'],
                                        fg=self.colors['text'], font=('Consolas', 9),
                                        yscrollcommand=sb.set, borderwidth=0,
                                        highlightthickness=0,
                                        selectbackground=self.colors['accent'])
        self.activity_list.pack(fill='both', expand=True, padx=5, pady=5)
        sb.config(command=self.activity_list.yview)
        return frame

    def create_reports_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors['bg_dark'])

        ctrl = tk.Frame(frame, bg=self.colors['bg_medium'])
        ctrl.pack(fill='x', padx=10, pady=10)
        tk.Label(ctrl, text="📊 Attendance Reports",
                 bg=self.colors['bg_medium'], fg=self.colors['text'],
                 font=('Segoe UI', 16, 'bold')).pack(pady=10)

        dates = tk.Frame(ctrl, bg=self.colors['bg_medium'])
        dates.pack(pady=10)
        for col, (lbl, attr) in enumerate([("From:", "from_date"), ("To:", "to_date")]):
            tk.Label(dates, text=lbl, bg=self.colors['bg_medium'],
                     fg=self.colors['text'], font=('Segoe UI', 10, 'bold')).grid(row=0, column=col*2, padx=5)
            e = tk.Entry(dates, bg=self.colors['bg_light'], fg=self.colors['text'],
                         font=('Segoe UI', 10), width=15)
            e.insert(0, datetime.date.today().strftime("%Y-%m-%d"))
            e.grid(row=0, column=col*2+1, padx=5)
            setattr(self, attr, e)

        btns = tk.Frame(ctrl, bg=self.colors['bg_medium'])
        btns.pack(pady=10)
        self.create_modern_button(btns, "📈 Generate Report", self.generate_report,  self.colors['accent']).pack(side='left', padx=5)
        self.create_modern_button(btns, "💾 Export CSV",      self.export_to_csv,    self.colors['success']).pack(side='left', padx=5)

        table_frame = tk.Frame(frame, bg=self.colors['bg_medium'])
        table_frame.pack(fill='both', expand=True, padx=10, pady=10)

        style = ttk.Style()
        style.configure("Modern.Treeview",
                        background=self.colors['bg_dark'],
                        foreground=self.colors['text'],
                        fieldbackground=self.colors['bg_dark'], borderwidth=0)
        style.map('Modern.Treeview', background=[('selected', self.colors['accent'])])

        cols = ('Name', 'Date', 'Time', 'Action', 'Confidence', 'Synced')
        self.report_tree = ttk.Treeview(table_frame, columns=cols,
                                        show='headings', style="Modern.Treeview")
        for c in cols:
            self.report_tree.heading(c, text=c)
            self.report_tree.column(c, width=160)

        sb = ttk.Scrollbar(table_frame, orient='vertical', command=self.report_tree.yview)
        self.report_tree.configure(yscrollcommand=sb.set)
        self.report_tree.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        sb.pack(side='right', fill='y')
        return frame

    def create_manage_tab(self):
        frame = tk.Frame(self.notebook, bg=self.colors['bg_dark'])

        hdr = tk.Frame(frame, bg=self.colors['bg_medium'])
        hdr.pack(fill='x', padx=10, pady=10)
        tk.Label(hdr, text="👥 Manage Registered Users",
                 bg=self.colors['bg_medium'], fg=self.colors['text'],
                 font=('Segoe UI', 16, 'bold')).pack(pady=10)

        btns = tk.Frame(hdr, bg=self.colors['bg_medium'])
        btns.pack(pady=10)
        self.create_modern_button(btns, "🔄 Refresh",        self.refresh_user_list, self.colors['accent']).pack(side='left', padx=5)
        self.create_modern_button(btns, "🗑️ Delete Selected", self.delete_user,       self.colors['error']).pack(side='left', padx=5)

        table_frame = tk.Frame(frame, bg=self.colors['bg_medium'])
        table_frame.pack(fill='both', expand=True, padx=10, pady=10)

        cols = ('ID', 'Name', 'Employee ID', 'Department', 'Convex ID', 'Reg. Date')
        self.user_tree = ttk.Treeview(table_frame, columns=cols,
                                      show='headings', style="Modern.Treeview")
        for c in cols:
            self.user_tree.heading(c, text=c)
            self.user_tree.column(c, width=140)

        sb = ttk.Scrollbar(table_frame, orient='vertical', command=self.user_tree.yview)
        self.user_tree.configure(yscrollcommand=sb.set)
        self.user_tree.pack(side='left', fill='both', expand=True, padx=5, pady=5)
        sb.pack(side='right', fill='y')

        self.refresh_user_list()
        return frame

    def create_status_bar(self):
        sf = tk.Frame(self.root, bg=self.colors['bg_medium'], height=35)
        sf.pack(fill='x', side='bottom')
        sf.pack_propagate(False)

        self.status_var = tk.StringVar(value="✓ System ready")
        tk.Label(sf, textvariable=self.status_var,
                 bg=self.colors['bg_medium'], fg=self.colors['text'],
                 font=('Segoe UI', 9), anchor='w').pack(side='left', padx=10, fill='x', expand=True)

        self.clock_label = tk.Label(sf, bg=self.colors['bg_medium'],
                                    fg=self.colors['text_secondary'],
                                    font=('Segoe UI', 9))
        self.clock_label.pack(side='right', padx=10)
        self.update_clock()

    def create_modern_button(self, parent, text, command, color):
        btn = tk.Button(parent, text=text, command=command,
                        bg=color, fg=self.colors['text'],
                        font=('Segoe UI', 10, 'bold'), relief='flat',
                        borderwidth=0, padx=20, pady=10, cursor='hand2',
                        activebackground=color, activeforeground=self.colors['text'])
        btn.bind('<Enter>', lambda e: btn.config(bg=self._adjust_color(color, -20)))
        btn.bind('<Leave>', lambda e: btn.config(bg=color))
        return btn

    def _adjust_color(self, hex_color, amount):
        h = hex_color.lstrip('#')
        rgb = tuple(max(0, min(255, int(h[i:i+2], 16) + amount)) for i in (0, 2, 4))
        return f'#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}'

    def update_clock(self):
        self.clock_label.config(text=datetime.datetime.now().strftime("%I:%M:%S %p • %B %d, %Y"))
        self.root.after(1000, self.update_clock)

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

        name        = self.reg_fields['Name'].get().strip()
        employee_id = self.reg_fields['Employee ID'].get().strip()
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
                self.reg_fields['Department'].get(),
                self.reg_fields['ID Number'].get(),
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

        # Capture 30 samples
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
            name = img_path.stem.split('_sample_')[0]
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
                    # LBPH: lower raw_confidence = better match.
                    # confidence_score (0–1): 1 = perfect match
                    confidence_score = max(0.0, 1.0 - raw_confidence / 100.0)

                    if raw_confidence < self.confidence_threshold:
                        name      = self.id_to_name.get(label, "Unknown")
                        box_color = (0, 255, 0)
                        self.mark_attendance(label, name, confidence_score)
                        self.recognition_label.config(
                            text=f"✓ {name} ({int(confidence_score * 100)}%)",
                            fg=self.colors['success']
                        )
                    else:
                        name      = "Unknown"
                        box_color = (0, 0, 255)
                        self.recognition_label.config(
                            text="⚠ Unknown Person",
                            fg=self.colors['warning']
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
        self.recognition_label.config(text="Camera stopped", fg=self.colors['text_secondary'])
        self.status_var.set("Camera stopped")

    def display_frame(self, frame, widget):
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        photo = ImageTk.PhotoImage(image)
        widget.configure(image=photo, text="")
        widget.image = photo

    # ===== ATTENDANCE =====

    def mark_attendance(self, user_id: int, name: str, confidence: float):
        current_time = datetime.datetime.now()

        # Cooldown check
        if name in self.last_recognition:
            if (current_time - self.last_recognition[name]).total_seconds() < self.recognition_cooldown:
                return

        action = "timeIn" if current_time.hour < 12 else "timeOut"
        status = "Time In" if action == "timeIn" else "Time Out"

        # Get Convex intern ID (or fall back to name lookup)
        conn   = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT convex_intern_id FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        convex_intern_id = row[0] if row else None

        # Save locally
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

        # Sync to Alt-Gio backend
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

        # Mark synced in DB
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

        # Queue for retry if sync failed
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
        """
        POST to /api/attendance/face-checkin
        Returns True on success, False on any error.
        """
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

            headers = {"Content-Type": "application/json"}
            if API_KEY:
                headers["Authorization"] = f"Bearer {API_KEY}"

            resp = requests.post(API_URL, json=payload, headers=headers, timeout=8)

            if resp.status_code == 200:
                data = resp.json()
                self.logger.info(
                    f"✓ Synced: {data.get('internName', intern_name)} — {data.get('action')}"
                )
                return True
            elif resp.status_code == 409:
                # Already complete / not found — not a transient error, don't retry
                self.logger.warning(f"Sync skipped (409): {resp.text}")
                return True   # treat as handled
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
            "att_id":          att_id,
            "intern_id":       convex_intern_id,
            "intern_name":     name,
            "action":          action,
            "confidence":      confidence,
            "iso_timestamp":   timestamp.isoformat(),
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
                time.sleep(60)          # retry queue every 60 seconds
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
            self.report_tree.insert('', 'end', values=(name, date, t, action, conf_str, synced_str))

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
        with open(csv_path, 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['Name', 'Date', 'Time', 'Action', 'Confidence', 'Synced'])
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
            self.user_tree.insert('', 'end', values=u)
        conn.close()

    def delete_user(self):
        sel = self.user_tree.selection()
        if not sel:
            messagebox.showwarning("Warning", "Please select a user")
            return
        if messagebox.askyesno("Confirm", "Delete selected user?"):
            item    = self.user_tree.item(sel[0])
            user_id = item['values'][0]
            name    = item['values'][1]
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


if __name__ == "__main__":
    app = ModernAttendanceSystem()
    app.run()
