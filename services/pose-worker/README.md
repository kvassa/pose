# pose-worker

FastAPI service: reference photo → MediaPipe Pose Landmarker (heavy) → keypoints + bounding box, delivered via async callback.

## Local dev

```powershell
cd services/pose-worker
py -3.11 -m pip install "fastapi>=0.115" "uvicorn[standard]>=0.32" "mediapipe==0.10.21" pillow httpx pydantic pytest

# Download model once (or let pytest conftest fetch it)
# models/pose_landmarker_heavy.task

$env:CALLBACK_SECRET = "dev-secret"
py -3.11 -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

```powershell
curl.exe http://localhost:8000/health
```

## Deploy (task 3.6)

Generate a callback secret (save for Supabase edge functions in phase 4):

```powershell
py -3.11 -c "import secrets; print(secrets.token_hex(32))"
```

### Option A — Railway (recommended)

Use **exactly one** of these setups (mixing them causes “Dockerfile not found”):

| Root Directory (Settings → Source) | Dockerfile path (Settings → Build) |
|----------------------------------|-------------------------------------|
| *(leave empty — repo root)* | `Dockerfile` |
| `services/pose-worker` | `Dockerfile` |

Do **not** set Root Directory to `services/pose-worker` **and** Dockerfile path to `services/pose-worker/Dockerfile` — Railway looks for `services/pose-worker/services/pose-worker/Dockerfile` and the build fails.

Typo check: folder is **`pose-worker`**, not `path-worker`.

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** (this repo).
2. **Settings → Source → Root Directory**: empty (repo root) **or** `services/pose-worker` (see table).
3. **Settings → Build**: Builder = **Dockerfile**, path = `Dockerfile` only.
4. **Variables** → add `CALLBACK_SECRET` = (secret from above).
5. **Settings → Resources**: **≥ 1 GB** RAM (MediaPipe).
6. Deploy. First build ~5–15 min (MediaPipe + model download).
7. **Settings → Networking → Generate Domain** (public HTTPS URL).
8. Test:

   ```powershell
   curl.exe https://YOUR-APP.up.railway.app/health
   ```

   Expected: `{"ok":true}`

### Option B — Fly.io

```powershell
cd services/pose-worker
fly auth login
fly launch --no-deploy
fly secrets set CALLBACK_SECRET=your-secret-here
fly deploy
fly certs show
curl.exe https://YOUR-APP.fly.dev/health
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| POST | `/extract` | Body: `{ reference_id, signed_image_url, callback_url }` → **202**, work in background |

Callback POST includes `X-Signature` (HMAC-SHA256 of JSON body, secret `CALLBACK_SECRET`).
