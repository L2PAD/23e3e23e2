# BIBI Cars V3.2 — Deployment Guide

A multi-cabinet auction-to-keys vehicle import platform.  This document
describes how to take the project from a fresh GitHub clone to a working
production deployment on a custom domain.

---

## 1. Repository layout

```
/app
├── backend/                # FastAPI :8001  — server.py + routers/* + workers
│   ├── chrome_extension/   # Auction parser extension (Poctra/Carsfromwest/etc)
│   ├── chrome_extension_vf/# Vessel Sync extension (VesselFinder cookies)
│   ├── requirements.txt
│   ├── .env.example
│   └── static/extensions/  # Pre-built ZIP packages (regenerated on every deploy)
├── frontend/               # React 19 (CRA + craco) :3000
│   ├── src/                # `pages/{admin,manager,team,cabinet,public}` + figma_home
│   ├── package.json
│   └── .env.example
└── DEPLOYMENT.md           # this file
```

---

## 2. Required runtime services

| Service | Purpose | Notes |
|---|---|---|
| **MongoDB 6.0+** | Primary data store: `vin_data`, leads, deals, shipments, sessions, etc. | Atlas (mongodb+srv://…) recommended for prod |
| **Python 3.11+** | Backend runtime | `pip install -r backend/requirements.txt` |
| **Node 20+ / yarn** | Frontend build | `yarn install && yarn build` |
| **Nginx / ingress** | TLS termination + routes `/api/*` → FastAPI, everything else → SPA build | Self-hosted or Cloudflare → origin |

---

## 3. Environment variables

Copy the templates and fill in real values **before first run**:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Critical secrets (must be generated, NOT reused)

```bash
# Strong 48-character random tokens
python -c "import secrets; print(secrets.token_urlsafe(48))" > JWT_SECRET
python -c "import secrets; print(secrets.token_urlsafe(48))" > EXT_SHARED_SECRET
```

Paste those into `backend/.env` as `JWT_SECRET=...` and `EXT_SHARED_SECRET=...`.

### `backend/.env` — mandatory fields

| Variable | Value |
|---|---|
| `MONGO_URL` | `mongodb+srv://user:pass@cluster/db?retryWrites=true&w=majority` |
| `DB_NAME` | `bibi_cars_prod` |
| `CORS_ORIGINS` | `https://your-domain.com,https://www.your-domain.com` — **never `*` in prod** |
| `JWT_SECRET` | 48+ chars random (see above) |
| `EXT_SHARED_SECRET` | 48+ chars random (see above) |
| `PUBLIC_SITE_URL` | `https://your-domain.com` |
| `EMERGENT_LLM_KEY` | provided separately (universal LLM key for text/image gen) |

### `frontend/.env`

| Variable | Value |
|---|---|
| `REACT_APP_BACKEND_URL` | `https://your-domain.com` (same origin as backend) |
| `WDS_SOCKET_PORT` | `443` (only matters for dev) |

---

## 4. First boot

```bash
# 1.  Install deps
cd backend  && pip install -r requirements.txt
cd ../frontend && yarn install

# 2.  Build the production SPA (output goes to frontend/build/)
yarn build

# 3.  Start the backend (uvicorn :8001 — point your reverse proxy here)
cd ../backend && uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
```

### What happens automatically on first start

1. **Seed staff accounts** — admin / manager / teamlead / customer rows in MongoDB.
   Default credentials are listed in `/app/backend/server.py::_seed_staff_from_env`.
   **Change the passwords on first login.**
2. **Seed blog articles** — 8 starter SEO articles.
3. **Create indexes** — search_logs / favorites / watchlist / vehicles.
4. **Spawn 7 background workers**: `ops_guardian`, `payment_reminder`,
   `resolver_worker`, `ringostat_cron`, `tracking_worker`,
   `transfer_detector`, `watchlist_live_poll`.

---

## 5. Seeding the vehicle catalogue

The system parses BitMotors live, but a cold catalogue is no fun.
After the backend is up, run:

```bash
cd /path/to/repo
python /app/backend/scripts/seed_bitmotors.py     # or /tmp/seed_bitmotors.py
```

This calls `BitmotorsFullSync.run_once(max_pages=500, concurrency=8)` and
populates `vin_data` with ~6 000 real auction lots in ~65 seconds.  No
mock data is ever inserted; if the source is unreachable the script
fails loudly.

---

## 6. Chrome Extensions

Both extensions are rebuilt automatically on every backend boot (or
manually via `bash backend/chrome_extension_vf/build.sh "$EXT_SHARED_SECRET"`).

Distribution URLs once the backend is running:

* `/api/static/extensions/bibi-vessel-sync.zip` — Vessel Sync (cookies + HMAC)
* `/api/static/extensions/bibi-cars-extension.zip` — Auction parser

The Vessel Sync popup pulls the HMAC secret from `BUILD_SECRET` (baked
into the ZIP).  Admins can also copy the same value from
**Admin → Settings → Tracking → VesselFinder → “Shared HMAC secret”**.

For the BIBI Cars parser, click **Generate new client** in the same
admin panel — the resulting `clientId` + `secret` pair is stored
hashed on the server and the plain-text secret is shown ONCE, then
cached locally in the admin's browser (`localStorage` key
`bibi.extClientSecrets.v1`).

---

## 7. Reverse-proxy routing (Nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # /api/* → FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        client_max_body_size 50M;
    }

    # Static SPA build
    root /var/www/bibi-frontend/build;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 8. Post-deploy verification

```bash
# 1.  Public catalogue size
curl -s https://your-domain.com/api/public/vehicles?limit=1 | jq '.total'

# 2.  Staff cabinets
for who in admin manager teamlead; do
  curl -s -X POST https://your-domain.com/api/auth/login \
       -H "Content-Type: application/json" \
       -d "{\"email\":\"$who@bibi.cars\",\"password\":\"CHANGE_ME\"}" | jq '.access_token != null'
done

# 3.  HMAC endpoint  (replace SECRET with EXT_SHARED_SECRET from .env)
python -c "
import hashlib, hmac, time, json, urllib.request
SECRET = b'REPLACE_WITH_EXT_SHARED_SECRET'
ts, path = str(int(time.time())), '/api/vesselfinder/heartbeat'
body = json.dumps({'agent':'test','ts':int(time.time()*1000)}).encode()
msg = f'{ts}\nPOST\n{path}\n{hashlib.sha256(body).hexdigest()}'.encode()
sig = hmac.new(SECRET, msg, hashlib.sha256).hexdigest()
print(urllib.request.urlopen(urllib.request.Request(
    f'https://your-domain.com{path}', data=body, method='POST',
    headers={'Content-Type':'application/json','X-Ext-Timestamp':ts,
             'X-Ext-Signature':sig,'X-Ext-Client':'bibi-vf-ext',
             'X-Ext-Nonce':'verify-001'})).read())
"
```

Expected: `total >= 5000`, three `true` lines, `{"ok":true,"serverTime":"..."}`.

---

## 9. Security checklist before going live

- [ ] `JWT_SECRET` and `EXT_SHARED_SECRET` regenerated for production
- [ ] `CORS_ORIGINS` set to explicit origins (no `*`)
- [ ] Default seeded passwords changed on first login
- [ ] `.env` files are NOT committed to Git (already in `.gitignore`)
- [ ] MongoDB uses authenticated connection string (`mongodb+srv://`)
- [ ] Nginx terminates TLS with a real certificate (Let's Encrypt or Cloudflare)
- [ ] Backend bound to `127.0.0.1:8001` so it is NOT directly reachable on port 8001 from the internet
- [ ] `/var/log/supervisor/backend.err.log` checked for `5xx`/`Traceback` lines

---

## 10. Where things live

| Concern | File / Endpoint |
|---|---|
| Staff seed credentials | `/app/backend/server.py::_seed_staff_from_env` |
| HMAC validation | `/app/backend/security.py::verify_ext_signature` |
| Extension keys admin UI | `/app/frontend/src/pages/admin/VesselFinderSessionPage.jsx` |
| BitMotors parser | `/app/backend/bitmotors_scraper.py::BitmotorsFullSync` |
| Welcome page (FigmaHome) | `/app/frontend/src/figma_home/components/frame-component21.jsx` |
| Catalog page | `/app/frontend/src/pages/public/CatalogPage.jsx` |
| Public car API | `GET /api/public/vehicles` |
| Vessel tracking worker | `/app/backend/server.py::_tracking_worker_loop` |
