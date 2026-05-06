"""
DICT Region V — Face Recognition Server
=======================================

Runs on the server (RTX 3060). Any browser on the LAN opens the
Next.js `/attendance/camera` page, streams JPEG frames over WebSocket,
and this server:

  1. Runs InsightFace detection + embedding on the GPU
  2. Matches embeddings against the locally-registered set (SQLite)
  3. Writes a row to the local `attendance_log` table (instant)
  4. Posts the event to the Convex `/face/attendance` httpAction
     (authenticated with a shared FACE_SHARED_TOKEN). Failed posts
     are retained in `sync_queue` and retried by a background worker.

IMPROVEMENTS over the first-pass spec
-------------------------------------
* Uses FastAPI lifespan instead of the deprecated @app.on_event.
* `logging` module instead of `print`.
* Env-driven CORS origins (no more wildcard in prod).
* Optional FACE_API_TOKEN gate on register/delete REST + WS init.
* Asia/Manila timezone-aware datetimes.
* GPU inference serialized via asyncio.Semaphore (avoids OOM when
  several browser tabs connect simultaneously).
* Per-(camera_id, user_id) cooldown — two cameras can both log the
  same person on entry/exit at different doors.
* Already-timed-out-today guard: a third event in a day is dropped,
  not inserted as a bogus time_out. Matches the Convex-side behaviour.
* Pydantic models for the register endpoint.
* Posts to the Convex httpAction with an X-Face-Token header (never
  ships the Convex admin key).
* `/health` no longer references a non-existent `sync_queue.synced`
  column (that was a bug in the original spec).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, date
from pathlib import Path
from typing import Optional, Any
from zoneinfo import ZoneInfo

import cv2
import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import (
    FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect,
    Header, status,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# ─── Logging ─────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
log = logging.getLogger("face_server")

# ─── Config ──────────────────────────────────────────────────────
# Convex self-hosted deploys HTTP actions on a separate port from the
# Convex API. FACE_CONVEX_HTTP_URL is the base URL to reach the HTTP
# actions router — e.g. http://127.0.0.1:3211 for local self-hosted.
CONVEX_HTTP_URL  = os.getenv("FACE_CONVEX_HTTP_URL", "http://localhost:3211").rstrip("/")
CONVEX_ENDPOINT  = os.getenv("FACE_CONVEX_ENDPOINT", "/face/attendance")
FACE_SHARED_TOKEN = os.getenv("FACE_SHARED_TOKEN", "")   # must match Convex env

# Optional REST/WS auth. If set, REST + WS init messages must include
# a matching `X-Face-Api-Token` header / `apiToken` field.
FACE_API_TOKEN    = os.getenv("FACE_API_TOKEN", "")

DB_PATH          = os.getenv("FACE_DB_PATH", "/data/faces.db")
MATCH_THRESHOLD  = float(os.getenv("MATCH_THRESHOLD", "0.45"))
COOLDOWN_SECS    = int(os.getenv("COOLDOWN_SECONDS", "30"))
MAX_FRAME_BYTES  = int(os.getenv("MAX_FRAME_BYTES", str(4 * 1024 * 1024)))  # 4 MB
TIMEZONE         = ZoneInfo(os.getenv("TIMEZONE", "Asia/Manila"))
GPU_CONCURRENCY  = int(os.getenv("GPU_CONCURRENCY", "1"))   # 1 = serialized

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "*").split(",")
    if o.strip()
]

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8001"))

# Semaphore is initialised in the lifespan so it lives on the correct loop.
_gpu_sem: Optional[asyncio.Semaphore] = None

# ─── InsightFace (heavy — loaded once at startup) ───────────────
from insightface.app import FaceAnalysis

face_app: Optional[FaceAnalysis] = None


def _load_model() -> FaceAnalysis:
    """Eager-initialise InsightFace on the GPU. Called from lifespan."""
    log.info("Loading InsightFace buffalo_l model…")
    app = FaceAnalysis(
        name="buffalo_l",
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    log.info("InsightFace ready (CUDA if available; falls back to CPU).")
    return app


# ─── SQLite ──────────────────────────────────────────────────────
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Safe to call repeatedly."""
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS registered_faces (
            id            TEXT PRIMARY KEY,
            user_id       TEXT NOT NULL UNIQUE,
            name          TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'student',
            program       TEXT,
            embedding     BLOB NOT NULL,
            registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
            sample_count  INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS attendance_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            name        TEXT NOT NULL,
            confidence  REAL NOT NULL,
            camera_id   TEXT DEFAULT 'main',
            action      TEXT NOT NULL DEFAULT 'time_in',
            logged_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            synced      INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS attendance_user_date_idx
            ON attendance_log(user_id, DATE(logged_at));

        CREATE TABLE IF NOT EXISTS sync_queue (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            payload    TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            attempts   INTEGER DEFAULT 0,
            last_error TEXT
        );
        """
    )
    conn.commit()
    conn.close()


# ─── Time / tz helpers ───────────────────────────────────────────
def now_local() -> datetime:
    return datetime.now(tz=TIMEZONE)


def today_iso() -> str:
    return now_local().date().isoformat()


def now_iso() -> str:
    return now_local().isoformat()


# ─── Face matching ──────────────────────────────────────────────
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def find_match(embedding: np.ndarray) -> Optional[dict]:
    """Linear scan vs all registered faces. Fine for < ~10k people."""
    conn = get_db()
    rows = conn.execute(
        "SELECT user_id, name, role, program, embedding FROM registered_faces"
    ).fetchall()
    conn.close()

    best_score  = 0.0
    best_match: Optional[dict] = None

    for row in rows:
        stored = np.frombuffer(row["embedding"], dtype=np.float32)
        score  = cosine_similarity(embedding, stored)
        if score > best_score:
            best_score = score
            best_match = dict(row)
            best_match["confidence"] = score

    if best_match and best_score >= MATCH_THRESHOLD:
        best_match.pop("embedding", None)
        return best_match
    return None


def has_timed_out_today(user_id: str) -> bool:
    """True iff this user already has a time_out recorded today."""
    conn = get_db()
    row = conn.execute(
        "SELECT 1 FROM attendance_log "
        "WHERE user_id=? AND action='time_out' AND DATE(logged_at)=? LIMIT 1",
        (user_id, today_iso()),
    ).fetchone()
    conn.close()
    return row is not None


def determine_action(user_id: str) -> str:
    """
    First event of the day → time_in.
    Second event           → time_out.
    Third+                 → still 'time_out' in label, but the caller
                             should check `has_timed_out_today` first and
                             skip inserting at all.
    """
    conn = get_db()
    count = conn.execute(
        "SELECT COUNT(*) FROM attendance_log WHERE user_id=? AND DATE(logged_at)=?",
        (user_id, today_iso()),
    ).fetchone()[0]
    conn.close()
    return "time_out" if count > 0 else "time_in"


# ─── Cooldown (per camera + user) ───────────────────────────────
_cooldowns: dict[tuple[str, str], float] = {}

# ─── Live "currently visible" snapshot ──────────────────────────
# Last frame's recognition results, refreshed by process_frame().
# Used by /api/visible so the Next.js /attendance overview can show
# a near-real-time preview of what the kiosk camera is seeing —
# without opening a second camera stream.
_current_visible: dict[str, Any] = {
    "faces":     [],
    "updatedAt": None,
    "cameraId":  "main",
}


def cooldown_key(camera_id: str, user_id: str) -> tuple[str, str]:
    return (camera_id, user_id)


def is_on_cooldown(camera_id: str, user_id: str) -> bool:
    last = _cooldowns.get(cooldown_key(camera_id, user_id), 0.0)
    return (time.time() - last) < COOLDOWN_SECS


def set_cooldown(camera_id: str, user_id: str) -> None:
    _cooldowns[cooldown_key(camera_id, user_id)] = time.time()


# ─── Convex post (+ sync queue) ─────────────────────────────────
async def _post_to_convex(payload: dict) -> bool:
    """
    Returns True on success. Callers queue on failure.
    Payload shape matches the /face/attendance httpAction.
    """
    if not FACE_SHARED_TOKEN:
        log.warning("FACE_SHARED_TOKEN is empty — cannot post to Convex; queuing.")
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{CONVEX_HTTP_URL}{CONVEX_ENDPOINT}",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Face-Token":  FACE_SHARED_TOKEN,
                },
            )
            if resp.status_code == 200:
                return True
            log.warning(
                "Convex rejected attendance event %s: HTTP %s body=%s",
                payload.get("userId"), resp.status_code, resp.text[:200],
            )
            return False
    except Exception as e:
        log.warning("Convex post failed: %s", e)
        return False


async def post_attendance_to_convex(
    user_id: str, name: str, confidence: float,
    action: str, camera_id: str,
) -> bool:
    payload = {
        "userId":     user_id,
        "name":       name,
        "confidence": round(confidence, 4),
        "action":     action,
        "cameraId":   camera_id,
        "timestamp":  now_iso(),
    }

    ok = await _post_to_convex(payload)
    if ok:
        return True

    # Queue for retry.
    conn = get_db()
    conn.execute(
        "INSERT INTO sync_queue (payload) VALUES (?)",
        (json.dumps(payload),),
    )
    conn.commit()
    conn.close()
    return False


# ─── Background: retry sync queue ───────────────────────────────
async def sync_queue_worker() -> None:
    """Retry failed Convex posts every 60 seconds, up to 5 attempts each."""
    while True:
        await asyncio.sleep(60)
        try:
            conn = get_db()
            queued = conn.execute(
                "SELECT id, payload, attempts FROM sync_queue "
                "WHERE attempts < 5 ORDER BY created_at LIMIT 20"
            ).fetchall()
            conn.close()

            if not queued:
                continue

            for row in queued:
                try:
                    payload = json.loads(row["payload"])
                except Exception:
                    # Poison message — drop it.
                    conn = get_db()
                    conn.execute("DELETE FROM sync_queue WHERE id=?", (row["id"],))
                    conn.commit()
                    conn.close()
                    continue

                ok = await _post_to_convex(payload)
                conn = get_db()
                if ok:
                    conn.execute("DELETE FROM sync_queue WHERE id=?", (row["id"],))
                else:
                    conn.execute(
                        "UPDATE sync_queue SET attempts=attempts+1 WHERE id=?",
                        (row["id"],),
                    )
                conn.commit()
                conn.close()
        except Exception as e:
            log.exception("sync_queue_worker iteration crashed: %s", e)


# ─── Frame processing ────────────────────────────────────────────
async def process_frame(image_bytes: bytes, camera_id: str) -> dict:
    """Run InsightFace on a JPEG frame, log & post recognized faces."""
    assert _gpu_sem is not None, "GPU semaphore not initialised"
    assert face_app is not None, "face model not initialised"

    if len(image_bytes) == 0:
        return {"faces": [], "error": "empty_frame"}
    if len(image_bytes) > MAX_FRAME_BYTES:
        return {"faces": [], "error": "frame_too_large"}

    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"faces": [], "error": "invalid_image"}

    # Serialize GPU inference — multiple concurrent clients share the card.
    async with _gpu_sem:
        faces = await asyncio.get_event_loop().run_in_executor(
            None, face_app.get, img,
        )

    results: list[dict[str, Any]] = []

    for face in faces:
        embedding = face.normed_embedding.astype(np.float32)
        bbox      = face.bbox.astype(int).tolist()  # [x1, y1, x2, y2]
        det_score = float(face.det_score)

        match = find_match(embedding)

        if match:
            user_id = match["user_id"]

            if has_timed_out_today(user_id):
                # Person has already clocked out; don't spam new events.
                results.append({
                    "recognized":     True,
                    "userId":         user_id,
                    "name":           match["name"],
                    "role":           match["role"],
                    "program":        match["program"],
                    "confidence":     round(match["confidence"], 3),
                    "action":         "time_out",
                    "bbox":           bbox,
                    "detectionScore": round(det_score, 3),
                    "onCooldown":     True,
                    "note":           "already_timed_out_today",
                })
                continue

            if not is_on_cooldown(camera_id, user_id):
                set_cooldown(camera_id, user_id)
                action = determine_action(user_id)

                # Log locally first (instant feedback for the UI).
                conn = get_db()
                conn.execute(
                    """INSERT INTO attendance_log
                        (user_id, name, confidence, camera_id, action)
                        VALUES (?, ?, ?, ?, ?)""",
                    (user_id, match["name"],
                     match["confidence"], camera_id, action),
                )
                conn.commit()
                conn.close()

                # Fire-and-forget post to Convex (queued on failure).
                asyncio.create_task(post_attendance_to_convex(
                    user_id    = user_id,
                    name       = match["name"],
                    confidence = match["confidence"],
                    action     = action,
                    camera_id  = camera_id,
                ))
            else:
                action = determine_action(user_id)

            results.append({
                "recognized":     True,
                "userId":         user_id,
                "name":           match["name"],
                "role":           match["role"],
                "program":        match["program"],
                "confidence":     round(match["confidence"], 3),
                "action":         action,
                "bbox":           bbox,
                "detectionScore": round(det_score, 3),
                "onCooldown":     is_on_cooldown(camera_id, user_id),
            })
        else:
            results.append({
                "recognized":     False,
                "name":           "Unknown",
                "bbox":           bbox,
                "detectionScore": round(det_score, 3),
            })

    # Publish snapshot for the /api/visible poller (kiosk → overview bridge).
    global _current_visible
    _current_visible = {
        "faces":     results,
        "updatedAt": now_iso(),
        "cameraId":  camera_id,
    }

    return {
        "faces":       results,
        "faceCount":   len(faces),
        "processedAt": now_iso(),
    }


# ─── App + lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _gpu_sem, face_app
    init_db()
    face_app = _load_model()
    _gpu_sem = asyncio.Semaphore(GPU_CONCURRENCY)
    worker   = asyncio.create_task(sync_queue_worker())
    try:
        yield
    finally:
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="DICT Face Recognition Server",
    description="GPU-accelerated face recognition + attendance sync",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth helpers ───────────────────────────────────────────────
def _require_api_token(header_value: Optional[str]) -> None:
    """Enforces FACE_API_TOKEN on REST endpoints when set."""
    if not FACE_API_TOKEN:
        return
    if header_value != FACE_API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Face-Api-Token",
        )


# ─── WebSocket ──────────────────────────────────────────────────
@app.websocket("/ws/camera")
async def camera_websocket(websocket: WebSocket):
    """
    Camera feed protocol (JSON text frames):

      Client → { "type": "init",  "cameraId": "entrance", "apiToken": "<optional>" }
      Client → { "type": "frame", "data": "<base64 JPEG>" }
      Server → { "type": "ready", "threshold": 0.45 }
      Server → { "type": "result", faces: [...], faceCount: N, processedAt: ISO }
      Server → { "type": "error", "message": "..." }
    """
    await websocket.accept()
    camera_id = "main"
    peer      = f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "?"
    log.info("Camera connected: %s", peer)

    try:
        async for raw in websocket.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "invalid_json"}))
                continue

            mtype = msg.get("type")

            if mtype == "init":
                # Optional token check.
                if FACE_API_TOKEN and msg.get("apiToken") != FACE_API_TOKEN:
                    await websocket.send_text(json.dumps({
                        "type": "error", "message": "invalid_api_token",
                    }))
                    await websocket.close(code=4401)
                    return
                camera_id = str(msg.get("cameraId") or "main")
                await websocket.send_text(json.dumps({
                    "type":      "ready",
                    "message":   f"Server ready. Camera: {camera_id}",
                    "threshold": MATCH_THRESHOLD,
                }))

            elif mtype == "frame":
                data = msg.get("data") or ""
                if not data:
                    continue
                try:
                    image_bytes = base64.b64decode(data, validate=False)
                except Exception:
                    await websocket.send_text(json.dumps({
                        "type": "error", "message": "invalid_base64",
                    }))
                    continue
                result = await process_frame(image_bytes, camera_id)
                await websocket.send_text(json.dumps({"type": "result", **result}))

            else:
                await websocket.send_text(json.dumps({
                    "type": "error", "message": f"unknown_type:{mtype}",
                }))

    except WebSocketDisconnect:
        log.info("Camera disconnected: %s", peer)
    except Exception as e:
        log.exception("WebSocket loop crashed: %s", e)
        try:
            await websocket.send_text(json.dumps({
                "type": "error", "message": str(e),
            }))
        except Exception:
            pass


# ─── REST: register / remove / list ─────────────────────────────
class RegisterResponse(BaseModel):
    success:     bool
    userId:      str
    name:        str
    sampleCount: int
    message:     str


@app.post("/api/register", response_model=RegisterResponse)
async def register_face(
    userId:  str        = Form(...),
    name:    str        = Form(...),
    role:    str        = Form("student"),
    program: str        = Form(""),
    file:    UploadFile = File(...),
    x_face_api_token: Optional[str] = Header(None, alias="X-Face-Api-Token"),
):
    """Enroll a face. Can be called multiple times per userId to add samples
    (embedding is weighted-averaged with existing samples)."""
    _require_api_token(x_face_api_token)

    # Basic validation.
    if file.content_type not in {"image/jpeg", "image/png", "image/jpg"}:
        raise HTTPException(400, f"Unsupported content-type: {file.content_type}")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(400, "Empty upload")
    if len(image_bytes) > MAX_FRAME_BYTES * 2:  # registration photos can be larger
        raise HTTPException(413, "Image too large")

    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Cannot decode image")

    assert face_app is not None
    faces = face_app.get(img)

    if len(faces) == 0:
        raise HTTPException(400, "No face detected. Use a clear front-facing photo.")
    if len(faces) > 1:
        raise HTTPException(
            400,
            f"Multiple faces detected ({len(faces)}). Use a photo with only the person being registered.",
        )

    embedding = faces[0].normed_embedding.astype(np.float32)
    record_id = hashlib.md5(userId.encode()).hexdigest()

    conn = get_db()
    existing = conn.execute(
        "SELECT embedding, sample_count FROM registered_faces WHERE user_id=?",
        (userId,),
    ).fetchone()

    if existing:
        old_emb = np.frombuffer(existing["embedding"], dtype=np.float32)
        count   = existing["sample_count"]
        # Weighted average: existing samples each carry equal weight.
        new_emb  = ((old_emb * count) + embedding) / (count + 1)
        new_emb /= (np.linalg.norm(new_emb) + 1e-9)
        conn.execute(
            """UPDATE registered_faces
                SET embedding=?, sample_count=?, name=?, role=?, program=?
                WHERE user_id=?""",
            (new_emb.tobytes(), count + 1, name, role, program, userId),
        )
        sample_count = count + 1
    else:
        conn.execute(
            """INSERT INTO registered_faces
                (id, user_id, name, role, program, embedding, sample_count)
                VALUES (?, ?, ?, ?, ?, ?, 1)""",
            (record_id, userId, name, role, program, embedding.tobytes()),
        )
        sample_count = 1

    conn.commit()
    conn.close()

    log.info("Registered %s (%s) — %d sample(s)", name, userId, sample_count)
    return RegisterResponse(
        success     = True,
        userId      = userId,
        name        = name,
        sampleCount = sample_count,
        message     = f"Face registered. {sample_count} sample(s) on record.",
    )


@app.delete("/api/register/{user_id}")
async def remove_face(
    user_id: str,
    x_face_api_token: Optional[str] = Header(None, alias="X-Face-Api-Token"),
):
    _require_api_token(x_face_api_token)
    conn = get_db()
    conn.execute("DELETE FROM registered_faces WHERE user_id=?", (user_id,))
    conn.commit()
    conn.close()
    log.info("Removed face %s", user_id)
    return {"success": True, "userId": user_id}


@app.get("/api/registered")
async def list_registered():
    conn = get_db()
    rows = conn.execute(
        "SELECT user_id, name, role, program, registered_at, sample_count "
        "FROM registered_faces ORDER BY registered_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/visible")
async def get_visible_faces():
    """Return the most recent frame's recognition results.

    Consumed by the Next.js `/attendance` overview's LiveDetectionPanel,
    which polls every 2 s. No auth — this is read-only preview data that
    the same browser could see directly in the kiosk tab anyway.
    """
    return _current_visible


@app.get("/api/attendance/today")
async def today_attendance():
    conn = get_db()
    rows = conn.execute(
        """SELECT user_id, name, confidence, camera_id, action, logged_at, synced
           FROM attendance_log
           WHERE DATE(logged_at)=?
           ORDER BY logged_at DESC""",
        (today_iso(),),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/health")
async def health():
    conn = get_db()
    reg = conn.execute("SELECT COUNT(*) FROM registered_faces").fetchone()[0]
    att = conn.execute(
        "SELECT COUNT(*) FROM attendance_log WHERE DATE(logged_at)=?",
        (today_iso(),),
    ).fetchone()[0]
    # The sync_queue has no `synced` column — rows are DELETED on success.
    queue_pending = conn.execute("SELECT COUNT(*) FROM sync_queue").fetchone()[0]
    queue_failed  = conn.execute(
        "SELECT COUNT(*) FROM sync_queue WHERE attempts >= 5"
    ).fetchone()[0]
    conn.close()
    return {
        "status":           "ok",
        "registeredFaces":  reg,
        "todayAttendance":  att,
        "unsyncedQueue":    queue_pending,
        "stuckQueue":       queue_failed,
        "threshold":        MATCH_THRESHOLD,
        "cooldownSeconds":  COOLDOWN_SECS,
        "timezone":         str(TIMEZONE),
        "modelLoaded":      face_app is not None,
    }


# Alias for platforms that expect /healthz.
@app.get("/healthz")
async def healthz():
    return await health()


# ─── Run ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        workers=1,       # Single worker — InsightFace holds GPU state.
        log_level=os.getenv("UVICORN_LOG_LEVEL", "info"),
    )


# ─────────────────────────────────────────────────────────────
# Video Compression Endpoint
# ─────────────────────────────────────────────────────────────
import subprocess
import tempfile
import httpx as _httpx
from fastapi import UploadFile, File, Form, Request
from fastapi.responses import FileResponse

@app.post("/compress")
async def compress_video(
    file: UploadFile = File(...),
    convex_url: str = Form(...),   # where to PUT the compressed file
    token: str = Form(...),         # Convex upload token
):
    """
    Accepts a raw video upload, compresses it with NVENC (falls back to
    libx264 on CPU if GPU unavailable), then uploads the result directly
    to Convex storage.
    """
    suffix = ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".input") as tmp_in:
        tmp_in.write(await file.read())
        input_path = tmp_in.name

    output_path = input_path + suffix

    # Probe duration
    probe = subprocess.run([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        input_path
    ], capture_output=True, text=True)
    try:
        duration = float(probe.stdout.strip())
    except Exception:
        duration = 999

    # Choose codec and settings based on duration
    if duration <= 10:
        # Very short — WebM VP9 for tiny file size + looping
        output_path = input_path + ".mp4"
        video_args = ["-c:v", "h264_nvenc", "-preset", "fast", "-b:v", "800k",
                      "-vf", "scale=trunc(iw*min(1\,1280/iw)/2)*2:trunc(ih*min(1\,720/ih)/2)*2",
                      "-profile:v", "baseline", "-movflags", "+faststart"]
        content_type = "video/mp4"
    elif duration <= 30:
        # Short — H.264 NVENC 720p 1.5Mbps
        video_args = ["-c:v", "h264_nvenc", "-preset", "fast", "-b:v", "1500k",
                      "-vf", "scale=trunc(iw*min(1\\,1280/iw)/2)*2:trunc(ih*min(1\\,720/ih)/2)*2"]
        content_type = "video/mp4"
    else:
        # Long — H.264 NVENC 720p 2Mbps
        video_args = ["-c:v", "h264_nvenc", "-preset", "fast", "-b:v", "2000k",
                      "-vf", "scale=trunc(iw*min(1\\,1280/iw)/2)*2:trunc(ih*min(1\\,720/ih)/2)*2"]
        content_type = "video/mp4"

    # Run FFmpeg
    cmd = ["ffmpeg", "-y", "-i", input_path] + video_args + \
          ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output_path]

    result = subprocess.run(cmd, capture_output=True, text=True)

    # Fallback to CPU if NVENC failed
    if result.returncode != 0 and "h264_nvenc" in " ".join(cmd):
        cmd = ["ffmpeg", "-y", "-i", input_path,
               "-c:v", "libx264", "-preset", "fast", "-b:v", "2000k",
               "-vf", "scale=trunc(iw*min(1\\,1280/iw)/2)*2:trunc(ih*min(1\\,720/ih)/2)*2",
               "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output_path]
        result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        import os; os.unlink(input_path)
        return {"error": "Compression failed", "details": result.stderr[-500:]}

    # Upload compressed file to Convex
    with open(output_path, "rb") as f:
        compressed_data = f.read()

    async with _httpx.AsyncClient() as client:
        upload_resp = await client.post(
            convex_url,
            content=compressed_data,
            headers={"Content-Type": content_type},
            timeout=120,
        )

    # Cleanup
    import os
    os.unlink(input_path)
    os.unlink(output_path)

    if upload_resp.status_code not in (200, 201):
        return {"error": f"Convex upload failed: {upload_resp.status_code}"}

    result_json = upload_resp.json()
    return {
        "storageId": result_json.get("storageId"),
        "duration": duration,
        "contentType": content_type,
        "compressed": True,
    }


@app.post("/compress-from-convex")
async def compress_from_convex(request: Request):
    """
    Downloads a video from Convex storage, compresses it with NVENC,
    re-uploads the compressed version, and returns the new storageId.

    Body JSON:
    {
        "download_url": "https://convex.dict.it.com/api/storage/...",
        "upload_url":   "https://convex.dict.it.com/api/storage/upload?token=...",
        "content_type": "video/mp4"
    }
    """
    import os, tempfile, subprocess
    body = await request.json()
    download_url = body.get("download_url")
    upload_url   = body.get("upload_url")

    if not download_url or not upload_url:
        return {"error": "download_url and upload_url required"}

    # Download from Convex
    async with _httpx.AsyncClient() as client:
        dl = await client.get(download_url, timeout=120, follow_redirects=True)
        if dl.status_code != 200:
            return {"error": f"Download failed: {dl.status_code}"}
        video_data = dl.content

    # Write to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".input") as tmp_in:
        tmp_in.write(video_data)
        input_path = tmp_in.name

    # Probe duration
    probe = subprocess.run([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        input_path
    ], capture_output=True, text=True)
    try:
        duration = float(probe.stdout.strip())
    except Exception:
        duration = 999

    # Choose format
    if duration <= 10:
        output_path = input_path + ".mp4"
        video_args = ["-c:v", "h264_nvenc", "-preset", "fast", "-b:v", "800k",
                      "-vf", "scale=trunc(iw*min(1\,1280/iw)/2)*2:trunc(ih*min(1\,720/ih)/2)*2",
                      "-profile:v", "baseline", "-movflags", "+faststart"]
        content_type = "video/mp4"
    elif duration <= 30:
        output_path = input_path + ".mp4"
        video_args = ["-c:v", "h264_nvenc", "-preset", "fast", "-b:v", "1500k",
                      "-vf", "scale=trunc(iw*min(1\\,1280/iw)/2)*2:trunc(ih*min(1\\,720/ih)/2)*2"]
        content_type = "video/mp4"
    else:
        output_path = input_path + ".mp4"
        video_args = ["-c:v", "h264_nvenc", "-preset", "fast", "-b:v", "2000k",
                      "-vf", "scale=trunc(iw*min(1\\,1280/iw)/2)*2:trunc(ih*min(1\\,720/ih)/2)*2"]
        content_type = "video/mp4"

    # Compress
    cmd = ["ffmpeg", "-y", "-i", input_path] + video_args + \
          ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output_path]
    result = subprocess.run(cmd, capture_output=True, text=True)

    # CPU fallback
    if result.returncode != 0 and "h264_nvenc" in " ".join(cmd):
        output_path2 = input_path + "_cpu.mp4"
        cmd = ["ffmpeg", "-y", "-i", input_path,
               "-c:v", "libx264", "-preset", "fast", "-b:v", "2000k",
               "-vf", "scale=trunc(iw*min(1\\,1280/iw)/2)*2:trunc(ih*min(1\\,720/ih)/2)*2",
               "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output_path2]
        result = subprocess.run(cmd, capture_output=True, text=True)
        output_path = output_path2
        content_type = "video/mp4"

    if result.returncode != 0:
        os.unlink(input_path)
        return {"error": "Compression failed", "details": result.stderr[-300:]}

    # Upload compressed to Convex
    with open(output_path, "rb") as f:
        compressed = f.read()

    original_size = len(video_data)
    compressed_size = len(compressed)

    async with _httpx.AsyncClient() as client:
        up = await client.post(
            upload_url,
            content=compressed,
            headers={"Content-Type": content_type},
            timeout=180,
        )

    os.unlink(input_path)
    os.unlink(output_path)

    if up.status_code not in (200, 201):
        return {"error": f"Upload failed: {up.status_code}"}

    result_json = up.json()
    return {
        "storageId": result_json.get("storageId"),
        "duration": duration,
        "contentType": content_type,
        "originalSize": original_size,
        "compressedSize": compressed_size,
        "ratio": round(original_size / max(compressed_size, 1), 2),
        "compressed": True,
    }
