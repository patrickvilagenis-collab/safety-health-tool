# Safety & Health — Backend

A small **Node.js + Express + SQLite** REST API that stores the platform's data
(visits, accidents, actions, photos) on a server so it persists and is shared
across users and devices. The front-end works offline and syncs to this API
when its URL is configured in **Settings → Backend sync**.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check (open, no key) |
| GET | `/api/:collection` | List all records |
| GET | `/api/:collection/:id` | Get one record |
| PUT | `/api/:collection/:id` | Create/update a record (full JSON in body) |
| DELETE | `/api/:collection/:id` | Delete a record |

Collections: `visits`, `accidents`, `actions`, `photos`, `meta`.

### Environment variables
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Port to listen on |
| `API_KEY` | _(empty)_ | If set, clients must send header `x-api-key: <key>` |
| `CORS_ORIGIN` | `*` | Allowed browser origin(s), e.g. your GitHub Pages URL |
| `DB_FILE` | `./data/safety.db` | SQLite file path (mount a volume here to persist) |

## Run locally

```bash
cd safety-platform/server
npm install
API_KEY=my-secret node server.js     # http://localhost:8080
```

## Run with Docker

```bash
cd safety-platform/server
docker compose up --build            # http://localhost:8080, data in ./data
```

or plain Docker:

```bash
docker build -t safety-health-backend .
docker run -p 8080:8080 -e API_KEY=my-secret -v "$PWD/data:/app/data" safety-health-backend
```

## Deploy options (you don't manage a server day-to-day)

- **Render.com (easiest, free to try):** there is a `render.yaml` at the repo
  root. In Render → **New → Blueprint** → connect the repo → **Apply**. You get a
  public HTTPS URL like `https://safety-health-backend.onrender.com` and a
  generated `API_KEY` (Render dashboard → Environment). Free instances use
  ephemeral storage (the database resets on restart) — fine for testing; add a
  paid Disk mounted at `/app/data` for permanent storage.
- **Azure (recommended for Schindler):** hand this folder / the Docker image to
  IT. Deploy to **Azure Container Apps** or **App Service for Containers**, set
  `API_KEY` and `CORS_ORIGIN`, and mount Azure Files at `/app/data` to persist.
- **Any VM / Docker host:** `docker compose up -d`.

## Connect the app

In the app open **Settings → Backend sync**, paste the **API base URL** and the
**API key**, then **Save & sync**. The current local data is pushed to the
server and the app reloads syncing from it. To go back to local-only, click
**Disconnect**.
