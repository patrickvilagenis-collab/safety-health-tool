# Safety & Health Information Tool

Mobile-first, **offline-capable** field safety platform (Schindler-branded):
field visits, accident investigation (RCA), operational learning events,
predictive SIF intelligence and AcciMap analysis — in one installable web app.

Vanilla JS ES modules, **no frameworks, no CDNs** — runs fully offline.

## Run locally
Static site — serve this folder with any static server:
```bash
npx serve .        # or: python3 -m http.server
```
Open the printed URL. No build step.

## Deploy (free) — GitHub Pages
Settings → Pages → Source: **Deploy from a branch** → Branch: **main** → Folder: **/ (root)** → Save.
Your app appears at `https://<user>.github.io/safety-health-tool/`.

## Install as an app (PWA)
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** the *Install* prompt appears (or menu → *Install app*).

## Optional sync backend
`render.yaml` is a Render.com blueprint that builds `server/Dockerfile` and gives
an HTTPS API URL. The app is fully usable without it (local-only).
