# Deploying VB Scout to Railway

This guide describes how to deploy the full VB Scout stack to [Railway](https://railway.app).

> **⚠️ Keep this file current.** Any change that affects how the app is deployed —
> a new service, a new/renamed environment variable, a Dockerfile port change, a new
> persistent volume, a start-command change, a new external dependency — **must** be
> reflected here in the same PR. This document is the source of truth for production config.

---

## Architecture

VB Scout runs as **four** Railway services backed by **one** managed Postgres database.
(The local `docker-compose.yml` also defines a `caddy` service for TLS — **not needed on
Railway**, which terminates TLS for you. Skip it.)

| Railway service | Source dir          | Runtime           | Listens on | Public? |
|-----------------|---------------------|-------------------|------------|---------|
| **Postgres**    | Railway plugin      | PostgreSQL 15     | 5432       | private |
| **api**         | `./api`             | Node 20 + Express | `$PORT`    | public  |
| **analysis**    | `./analysis-service`| Python 3.11 + FastAPI | `$PORT` | private (or public) |
| **web**         | `./web`             | nginx (static SPA)| 3000       | public  |

Request flow:

```
Browser ──► web (nginx, SPA + /api proxy) ──► api ──► Postgres
                                                │
                                                └──► analysis ──► Postgres
```

All four services deploy from **this same repo** (monorepo). For each one, create a
Railway service and set its **Root Directory** to the source dir above so Railway uses
the correct Dockerfile.

---

## 1. Create the project and database

1. Create a new Railway project.
2. **Add a Postgres database** (`New → Database → PostgreSQL`). Railway exposes it as a
   reference variable `${{Postgres.DATABASE_URL}}` you can wire into other services.
3. Use the **private** Postgres URL for service-to-service traffic (faster, no egress fees).

---

## 2. Deploy the `api` service

- **Root Directory:** `api`
- **Builder:** Dockerfile (`api/Dockerfile`)
- The container listens on `process.env.PORT` (Railway injects `$PORT`) — no change needed.
- The start command runs `npx prisma db push --accept-data-loss` then `node dist/index.js`,
  so the schema is applied automatically on every deploy.
- The reminder cron (`node-cron`) runs **inside** the api process. Keep api at a **single
  replica** so reminders don't fire multiple times.

### Persistent volume (required)

Player photos are written to disk and served from `/uploads`. Without a volume, uploaded
photos are lost on every redeploy.

- Attach a Railway **Volume** to the api service, mounted at **`/app/uploads`**
  (or any path, if you also set `UPLOADS_DIR` to match — defaults to `/app/uploads`).

### Environment variables

| Variable             | Value / notes                                                        |
|----------------------|----------------------------------------------------------------------|
| `DATABASE_URL`       | `${{Postgres.DATABASE_URL}}` (private)                               |
| `JWT_SECRET`         | `openssl rand -base64 32`                                            |
| `ANALYSIS_SERVICE_URL` | Private URL of the analysis service, e.g. `http://analysis.railway.internal:$PORT` (use the analysis service's internal hostname/port) |
| `RESEND_API_KEY`     | Resend API key (transactional email)                                 |
| `SUPERADMIN_EMAIL`   | Bootstrap admin email (seeded on first boot)                         |
| `SUPERADMIN_PASSWORD`| Bootstrap admin password                                            |
| `VAPID_PUBLIC_KEY`   | From `npx web-push generate-vapid-keys` (push notifications)          |
| `VAPID_PRIVATE_KEY`  | From the same command                                                |
| `VAPID_MAILTO`       | `mailto:you@yourdomain.com`                                          |
| `ALLOWED_ORIGINS`    | **Comma-separated public origins allowed by CORS.** Add the web service's public URL here, e.g. `https://app.yourdomain.com`. (localhost origins are always allowed.) |
| `UPLOADS_DIR`        | Optional; only set if the volume mount path ≠ `/app/uploads`         |

> **Never set `WIPE_ALL_DATA=true` in production** unless you intend to delete all data.
> The app logs a reminder to remove it after one boot — do so and redeploy.

After deploy, generate a **public domain** for the api (Settings → Networking) if the
browser calls the API directly (see web Option A below).

---

## 3. Deploy the `analysis` service

- **Root Directory:** `analysis-service`
- **Builder:** Dockerfile (`analysis-service/Dockerfile`)

> **⚠️ Port gotcha.** The Dockerfile's `CMD` hardcodes `--port 8001`. Railway routes to
> `$PORT`. Pick one:
> - **Override the start command** (recommended) in Railway settings to:
>   `uvicorn main:app --host 0.0.0.0 --port $PORT`, **or**
> - Set the service's **target port to `8001`** under Settings → Networking.
>
> If you change how this service binds its port, update both the Dockerfile and this note.

This service is usually **private** (only the api calls it). Reference it from the api via
its `*.railway.internal` hostname.

### Environment variables

| Variable        | Value / notes                          |
|-----------------|----------------------------------------|
| `DATABASE_URL`  | `${{Postgres.DATABASE_URL}}` (private) |
| `N_SIMS`        | `10000` (Monte Carlo simulations)      |
| `N_SENSITIVITY` | `5000`                                 |
| `MIN_RALLIES`   | `20`                                   |
| `TUS_WINDOW`    | `6`                                    |

Health check: `GET /health`.

---

## 4. Deploy the `web` service

- **Root Directory:** `web`
- **Builder:** Dockerfile (`web/Dockerfile`)

> **⚠️ Port gotcha.** nginx listens on a hardcoded `listen 3000` (`web/nginx.conf`).
> Set the web service's **target port to `3000`** under Settings → Networking so Railway
> routes public traffic correctly. If you change the nginx listen port, update this note.

### Build-time variables (Vite — baked into the bundle at build, not runtime)

These are Docker **build args** consumed by `web/Dockerfile`. Set them as Railway service
variables; Railway passes service variables as build args.

| Variable                 | Value / notes                                                          |
|--------------------------|------------------------------------------------------------------------|
| `VITE_API_URL`           | See the two options below                                              |
| `VITE_VAPID_PUBLIC_KEY`  | Same value as the api's `VAPID_PUBLIC_KEY`                              |
| `VITE_APP_VERSION`       | Optional build/version string                                          |

### Connecting web → api: two options

**Option A — browser calls the API directly (simplest on Railway):**
1. Set `VITE_API_URL` to the api's **public** URL (e.g. `https://api.yourdomain.com`).
2. Add the web public URL to the api's `ALLOWED_ORIGINS` (for CORS).

**Option B — nginx reverse-proxies `/api` (no CORS, keeps API private):**
1. Leave `VITE_API_URL` pointing at the same origin (relative `/api` calls).
2. Set the **runtime** env var `API_UPSTREAM` on the web service to the api's private URL
   (e.g. `http://api.railway.internal:$PORT`). nginx proxies `/api` and `/uploads` to it.
   With this option the api can stay private (no public domain needed).

Generate a **public domain** for the web service and point your custom domain at it.

---

## 5. Post-deploy checklist

- [ ] Postgres reachable; `prisma db push` ran (check api deploy logs).
- [ ] Superadmin can log in with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.
- [ ] `GET /health` returns `{"status":"ok"}` on api; `GET /health` OK on analysis.
- [ ] Completing a match triggers analysis (api → analysis call succeeds; check logs).
- [ ] Player photo upload survives a redeploy (volume mounted at `/app/uploads`).
- [ ] Push notifications work (VAPID keys match between api and web).
- [ ] `WIPE_ALL_DATA` is **unset** on the api service.

---

## Environment variable quick reference

| Service  | Required env vars |
|----------|-------------------|
| api      | `DATABASE_URL`, `JWT_SECRET`, `ANALYSIS_SERVICE_URL`, `RESEND_API_KEY`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO`, `ALLOWED_ORIGINS` |
| analysis | `DATABASE_URL`, `N_SIMS`, `N_SENSITIVITY`, `MIN_RALLIES`, `TUS_WINDOW` |
| web      | `VITE_API_URL`, `VITE_VAPID_PUBLIC_KEY` (build), `API_UPSTREAM` (runtime, Option B only) |

See `.env.example` and `web/.env.example` for the canonical list of local variables.
