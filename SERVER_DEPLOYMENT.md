# DICT R5 PMS — Dedicated Server Deployment Guide

> **Scope.** This guide covers running the **entire stack** (Next.js + self-hosted Convex + Python face server) on a single Windows PC at the office, accessed by other PCs (kiosk, admin laptops) over your LAN.
>
> **Hardware verified.** Intel i7‑13700, 16 GB RAM, RTX 3060 12 GB → comfortably enough. Face server peaks at ~5 GB VRAM, the rest is CPU/RAM and easily fits.

If you came here from `DEPLOYMENT.md`, that document is for **Netlify cloud** deployment of the frontend only. This document is the on‑prem / LAN equivalent.

---

## 1. What you'll end up with

```
┌──────────────────────── Host PC (Windows + WSL2 + Docker Desktop) ────────────────────────┐
│                                                                                           │
│   docker compose -f docker-compose.prod.yml --profile core up -d                          │
│                                                                                           │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐     │
│   │ convex-backend  │  │ face-recognition│  │      app        │  │ convex-dashboard │     │
│   │  :3210  client  │  │   :8001 (GPU)   │  │ :3000 Next.js   │  │     :6791        │     │
│   │  :3211  http    │  │                 │  │                 │  │                  │     │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘  └──────────────────┘     │
│         ▲                     ▲                     ▲                    ▲                │
└─────────┼─────────────────────┼─────────────────────┼────────────────────┼────────────────┘
          │                     │                     │                    │
          ╰────── all bound to host LAN IP, e.g. 192.168.1.50 (Windows host) ─────────╯
                                          │
                ┌──────────────────────────┼──────────────────────────┐
                ▼                          ▼                          ▼
       Kiosk PC (browser)         Admin laptop (browser)        Camera-attached PC
       http://192.168.1.50:3000   /attendance, /dashboard       (could BE the host PC)
       /attendance/kiosk
```

**Ports exposed on the host:**

| Port | Service           | Who uses it                          |
| ---- | ----------------- | ------------------------------------ |
| 3000 | Next.js app       | Every browser on the LAN             |
| 3210 | Convex API/WS     | Every browser (Convex client)        |
| 3211 | Convex HTTP route | Internal — face server → Convex      |
| 6791 | Convex dashboard  | You only, for debugging schema/data  |
| 8001 | Face server       | Browsers on the kiosk + camera pages |

---

## 2. Phase 0 — Prep the host PC (one‑time, ~30 min)

### 2.1 Install WSL2 + Ubuntu

Open PowerShell **as Administrator**:

```powershell
wsl --install -d Ubuntu-22.04
wsl --set-default-version 2
```

Reboot when asked. On first launch of Ubuntu, set a username + password.

### 2.2 Install NVIDIA driver for WSL2 (CRITICAL for the face server)

Two pieces:

1. **Windows-side NVIDIA driver** — download the latest **Game Ready or Studio driver** from <https://www.nvidia.com/Download/index.aspx>. Modern drivers ship WSL GPU support automatically. After install, in PowerShell:

   ```powershell
   nvidia-smi   # should show your RTX 3060
   ```

2. **CUDA inside WSL2** — *not needed*. Docker containers ship their own CUDA. Just verify GPU passthrough works inside WSL:

   ```bash
   wsl
   nvidia-smi   # should show the SAME RTX 3060 from inside WSL
   ```

   If `nvidia-smi` is missing inside WSL, your Windows driver is too old. Update it.

### 2.3 Install Docker Desktop

Download from <https://www.docker.com/products/docker-desktop/>. After install:

1. Settings → **General** → ☑ "Use the WSL 2 based engine"
2. Settings → **Resources → WSL Integration** → ☑ Ubuntu‑22.04
3. Settings → **Resources → Advanced** → bump CPUs to 8, Memory to 10 GB (leaves 6 GB for Windows)
4. Quit & restart Docker Desktop.

Verify GPU access:

```powershell
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

You should see the RTX 3060 listed. If you see `could not select device driver "" with capabilities: [[gpu]]`, your driver/Docker integration isn't set up — re‑run 2.2 / 2.3.

### 2.4 Install git + Node 20 (only needed once, to seed Convex schema)

Inside WSL Ubuntu:

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should print v20.x
```

### 2.5 Find the host's LAN IP

PowerShell on Windows:

```powershell
ipconfig | findstr IPv4
```

Pick the address on your office network (typically `192.168.x.x`). **Reserve a static DHCP lease for this MAC address in your router** so the IP doesn't change. From here on, this guide writes that as `192.168.1.50` — substitute your actual IP everywhere you see it.

### 2.6 Open the firewall

PowerShell **as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "DICT-PMS Next.js"  -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "DICT-PMS Convex"   -Direction Inbound -LocalPort 3210 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "DICT-PMS ConvexHttp" -Direction Inbound -LocalPort 3211 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "DICT-PMS Face"     -Direction Inbound -LocalPort 8001 -Protocol TCP -Action Allow
```

---

## 3. Phase 1 — Get the code onto the host

Inside WSL Ubuntu:

```bash
cd ~
git clone <your-repo-url> dict-pms
cd dict-pms
```

> **Tip.** Keep the repo *inside the WSL filesystem* (`/home/<you>/...`), not on `/mnt/c/...`. Build performance and Docker bind mounts are dramatically better that way.

---

## 4. Phase 2 — Configure environment

### 4.1 Generate secrets

```bash
openssl rand -hex 32       # → CONVEX_INSTANCE_SECRET
openssl rand -base64 32    # → NEXTAUTH_SECRET, DICT_OAUTH_SECRET
openssl rand -hex 24       # → FACE_SHARED_TOKEN
```

### 4.2 Create `.env.production`

```bash
cp .env.production.example .env.production
nano .env.production
```

Paste the secrets from 4.1 and **replace every `192.168.1.50` with your actual host LAN IP** (from 2.5). The values that matter the most:

| Variable                          | Why                                                              |
| --------------------------------- | ---------------------------------------------------------------- |
| `CONVEX_INSTANCE_SECRET`          | Encrypts Convex's at-rest data. **Never change after first run.** |
| `CONVEX_CLOUD_ORIGIN`             | What the Convex client connects to. Must be reachable from kiosk PC. |
| `NEXT_PUBLIC_CONVEX_URL`          | Same value — baked into the JS bundle at build time.             |
| `NEXT_PUBLIC_FACE_SERVER_HTTP/WS` | What the kiosk's browser calls for face recognition.             |
| `FACE_SHARED_TOKEN`               | Authenticates face server → Convex webhook.                      |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL`| Sessions for Google OAuth login.                                 |

### 4.3 Update Google OAuth redirect URIs

In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → "Authorized redirect URIs", add:

```
http://192.168.1.50:3000/api/auth/callback/google
http://192.168.1.50:3000/api/auth/google/callback
```

(Replace with your actual IP.) Without this, Google login will fail with `redirect_uri_mismatch`.

---

## 5. Phase 3 — First boot

```bash
docker compose -f docker-compose.prod.yml --profile core up -d --build
```

First build takes ~10 minutes (the face server pulls a CUDA base image and downloads the InsightFace model). Watch progress with:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Wait until you see:

- `pms-convex` → `Ready` and `listening on port 3210`
- `face-server` → `Uvicorn running on http://0.0.0.0:8001` and `Loaded face model`
- `pms-app`    → `started server on 0.0.0.0:3000`

### 5.1 Push your Convex schema + functions

Convex starts up empty — you need to deploy your `convex/` directory once:

```bash
# Get an admin key from the running backend
docker exec pms-convex ./generate_admin_key.sh
# → prints something like "self-hosted-convex|01abc..."

# Push schema + functions
export CONVEX_URL=http://192.168.1.50:3210
export CONVEX_ADMIN_KEY="<paste from above>"
npx convex deploy --url $CONVEX_URL --admin-key $CONVEX_ADMIN_KEY
```

> Save the admin key in a password manager — you'll need it for future schema changes.

### 5.2 Set Convex's server-side env vars

The Convex `httpAction` for `/face/attendance` checks the shared token. Set it on the deployment:

```bash
npx convex env set FACE_SHARED_TOKEN "<same value from .env.production>" \
  --url $CONVEX_URL --admin-key $CONVEX_ADMIN_KEY
```

If you use Google Sheets sync, also set the service account creds there (see `convex/googleSheetsWrite.ts`).

### 5.3 Sanity check

From the host PC:

```bash
curl http://192.168.1.50:3210/version              # Convex
curl http://192.168.1.50:3211/face/health          # → {"ok":true}
curl http://192.168.1.50:8001/healthz              # face server → 200
curl -I http://192.168.1.50:3000                   # Next.js → 200
```

---

## 6. Phase 4 — Bootstrap the first admin

Open `http://192.168.1.50:3000/login/admin` from the host PC, sign up the very first account. Then in the Convex dashboard at `http://192.168.1.50:6791`:

1. Find your user in the `users` table.
2. Run the `auth:bootstrapFirstAdmin` mutation (Functions tab) to grant admin role.

After this, you log in normally and admin all other users from `/dtc-admin`.

---

## 7. Phase 5 — Kiosk PC setup

The kiosk runs on a *separate* machine pointed at the host. It just needs Chrome/Edge.

### 7.1 Verify reachability

From the kiosk PC's browser:

```
http://192.168.1.50:3000           → main app loads
http://192.168.1.50:8001/healthz   → {"ok":true}
```

If `/healthz` fails, the firewall rules in 2.6 didn't take effect — re-check.

### 7.2 Open the kiosk

From the host PC's `/attendance` page, click **Open Kiosk** — it spawns the popup at `/attendance/kiosk`. **Drag that popup window to the kiosk PC's monitor** if you have multi-monitor, or open the URL directly on the kiosk PC.

### 7.3 Auto-launch Chrome in fullscreen on kiosk boot

On the **kiosk PC** (not the host):

1. Create a shortcut on the desktop with target:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --start-fullscreen --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://192.168.1.50:3000/attendance/kiosk
   ```

2. Press <kbd>Win</kbd>+<kbd>R</kbd> → `shell:startup` → drop the shortcut there.
3. In Chrome → Settings → Privacy → Site Settings → **Camera** → ⚙ for `192.168.1.50:3000` → Allow. (Otherwise the kiosk WS frames will be black.)

The `--autoplay-policy` flag is what lets the TTS greeting speak without a user click.

---

## 8. Phase 6 — Operations

### 8.1 Daily

```bash
docker compose -f docker-compose.prod.yml ps              # all should be "healthy"
docker compose -f docker-compose.prod.yml logs --tail=50  # quick sanity glance
```

### 8.2 Restart everything

```bash
docker compose -f docker-compose.prod.yml restart
```

### 8.3 Auto-start on Windows boot

Docker Desktop → Settings → **General** → ☑ "Start Docker Desktop when you sign in to your computer". Then in WSL Ubuntu, create `/etc/systemd/system/dict-pms.service`:

```ini
[Unit]
Description=DICT R5 PMS stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/home/<you>/dict-pms
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --profile core up -d
RemainAfterExit=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now dict-pms.service
```

Or simpler: Docker Desktop already restarts containers with `restart: unless-stopped` (already set in the compose file) — they'll come back automatically every time Docker Desktop starts.

### 8.4 Backups

The data lives in two named Docker volumes:

```bash
# Convex DB (everything: users, attendance, projects, etc.)
docker run --rm -v dict-pms_convex_data:/src -v /home/<you>/backups:/dst alpine \
  tar czf /dst/convex-$(date +%F).tgz -C /src .

# Face embeddings + per-user history
docker run --rm -v dict-pms_face_data:/src -v /home/<you>/backups:/dst alpine \
  tar czf /dst/faces-$(date +%F).tgz -C /src .
```

Add to a cron job in WSL:

```bash
crontab -e
# 0 2 * * *   /home/<you>/dict-pms/scripts/backup.sh
```

### 8.5 Updates

```bash
cd ~/dict-pms
git pull
docker compose -f docker-compose.prod.yml build app face-recognition
docker compose -f docker-compose.prod.yml up -d
# If schema changed:
npx convex deploy --url http://192.168.1.50:3210 --admin-key $CONVEX_ADMIN_KEY
```

---

## 9. Optional — One-port reverse proxy via Nginx

The compose file ships an `nginx` profile that serves everything on port 80. Bring it up with:

```bash
docker compose -f docker-compose.prod.yml --profile core --profile proxy up -d
```

Then your URLs become `http://192.168.1.50/` (Next.js), `http://192.168.1.50/convex/` (Convex), `http://192.168.1.50/ai/face/` (face server). You'd need to update `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_FACE_SERVER_HTTP/WS` to match — and rebuild the app container. Skip this for v1; direct ports are simpler.

---

## 10. Troubleshooting matrix

| Symptom                                                    | Likely cause                                                                                  | Fix                                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Kiosk PC shows "Cannot connect to server"                  | Firewall on host blocked port 3000/3210                                                       | Re-run firewall rules in §2.6                                                                                    |
| `nvidia-smi` works on host but face-server says "no GPU"   | Docker Desktop's NVIDIA integration isn't enabled                                             | Reinstall Docker Desktop, ensure WSL backend is on, latest Win NVIDIA driver                                     |
| Convex client gets `WebSocket failed`                      | `NEXT_PUBLIC_CONVEX_URL` was set to `localhost` instead of LAN IP at **build** time           | Re-build with `--build-arg NEXT_PUBLIC_CONVEX_URL=http://192.168.1.50:3210` or fix `.env.production` and rebuild |
| `/face/attendance` returns 401                             | `FACE_SHARED_TOKEN` mismatch between Convex env and `.env.production`                         | `npx convex env set FACE_SHARED_TOKEN ...` to match                                                              |
| Face server logs `Out of memory` after a few minutes       | `GPU_CONCURRENCY` too high                                                                    | Lower to 1 in `.env.production`; restart `face-recognition`                                                      |
| Google login → `redirect_uri_mismatch`                     | Redirect URI in Google Console doesn't include the LAN IP                                     | Add both URIs from §4.3                                                                                          |
| Camera page on kiosk PC shows black video                  | Chrome blocked the camera for `http://192.168.1.50:3000` (camera APIs need HTTPS *or* localhost) | In Chrome flags: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → add `http://192.168.1.50:3000` → relaunch |
| Containers exit with `permission denied` on `/data`        | Docker volume ownership                                                                       | `docker compose down -v` (⚠ wipes volumes), then up again                                                        |

---

## 11. Going further

- **HTTPS.** If you want HTTPS on the LAN, run `caddy` instead of nginx — it'll get certs from Let's Encrypt automatically *if* your LAN IP has a public DNS name pointed at it (e.g. via Cloudflare DNS + a Cloudflare Tunnel). For purely-internal LAN, generate a self-signed cert and import it into the kiosk PC's trusted root store.
- **Public access from outside the office.** Easiest: install **Cloudflare Tunnel** (`cloudflared`) on the host PC, point it at `http://localhost:80` (with the nginx profile up), and you get a public HTTPS URL with no port-forwarding. The compose file is already proxy-friendly.
- **Remote camera enrollment.** Faces enrolled on the kiosk's webcam already train across all cameras (the embedding is camera-agnostic). To add a 2nd camera, run a second Chrome window pointing at `/attendance/camera` from a different PC — it'll push frames to the *same* face server.

---

If you hit any step that doesn't behave as documented, paste the exact error + the relevant `docker compose logs <service> --tail=100` output and I'll diagnose.
