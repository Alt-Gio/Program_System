# DICT R5 — Face Recognition Server (server-based)

This is the **server-side** face recognition implementation that
runs on a GPU box (RTX 3060 or better) and serves any web browser on
the LAN. It replaces the old per-PC Tkinter desktop build that lives
in the sibling `cv-station/` folder (which is still used by the
legacy `/api/cv-station/download` admin flow — do not delete it).

```
browser  ──ws──▶  this server  ──https──▶  Convex httpAction  ──▶  face_attendance table
/attendance                (8001)           /face/attendance          (live subscribed by UI)
```

Every recognized face writes **locally** to SQLite first (instant
UI feedback), then posts to Convex. Failed posts are queued in
`sync_queue` and retried every 60 s (up to 5 attempts each).

## Architecture choices

| Concern                       | Choice                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| Face detection + embeddings   | InsightFace `buffalo_l` (ArcFace, 512-D normed)                |
| Inference device              | CUDA if available, else CPU. GPU calls serialized (Semaphore). |
| Python ↔ Convex auth          | Shared `FACE_SHARED_TOKEN` header — **never** the admin key.   |
| Browser ↔ Python auth         | Optional `FACE_API_TOKEN` (see .env.example).                  |
| Timezone                      | `Asia/Manila` by default; all day-boundaries use it.           |
| Time-in vs time-out           | Decided **server-side** from today's event count. Idempotent.  |
| Cooldown                      | Per-(cameraId, userId) — two cameras can log the same person.  |

## Local development

```bash
cd cv-station/server
cp .env.example .env    # edit the tokens
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

First run downloads the ~300 MB InsightFace model into
`~/.insightface/models/buffalo_l/`.

## Docker

From the repo root:

```bash
docker compose -f cv-station/docker-compose.yml up --build -d
docker compose -f cv-station/docker-compose.yml logs -f
```

Requires the NVIDIA Container Toolkit on the host. Data persists in
the named volumes `face_data` (SQLite) and `face_models` (the
InsightFace cache — avoids the 300 MB re-download on every rebuild).

## Configuring the Convex side

```bash
# one-time — on the Convex deployment
npx convex env set FACE_SHARED_TOKEN "<same value as .env>"
```

Once set, the Python server can POST to `/face/attendance` on the
Convex httpAction router and events will land in the `face_attendance`
table, which the `/attendance` pages subscribe to.

## Endpoints

| Method | Path                      | Purpose                                             |
| ------ | ------------------------- | --------------------------------------------------- |
| WS     | `/ws/camera`              | Browser frame stream → recognition results          |
| POST   | `/api/register`           | Enroll a face (multipart form, JPEG/PNG)            |
| DELETE | `/api/register/{user_id}` | Remove a face                                       |
| GET    | `/api/registered`         | List registered faces                               |
| GET    | `/api/attendance/today`   | Local attendance log (mirrors Convex, offline-safe) |
| GET    | `/health`, `/healthz`     | JSON health + queue stats                           |

## Things this implementation does NOT do (yet)

- **Liveness / anti-spoofing** — printed photos can trigger a match.
  Add a motion / depth / blink-detection step before shipping to a
  security-critical environment.
- **Horizontal scaling** — the in-memory cooldown + single SQLite
  file mean running two replicas of this server behind a load
  balancer will misbehave. For multi-GPU setups, shard by camera.
