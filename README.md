# Leximeter

> **Discover every language on a website — in seconds.**

Leximeter is a web diagnostic tool that scans a domain and tells you which languages it supports. Drop in a list of websites, hit **Run**, and get a clean table showing language counts, language names, and a flag for any site that warrants a closer look.

It's useful for **SEO audits**, **accessibility reviews**, and **localization gap analysis**.

---

## How it works (for everyone)

1. Paste one or more domain names into the input box.
2. Click **Run Analysis**.
3. Leximeter visits each site in the background, reads its language signals, and builds a report.
4. The results table appears automatically — showing every language detected and whether manual review is recommended.
5. Download the results as a CSV whenever you're ready.

> Results for single-page apps may take a few extra seconds — Leximeter waits for the page to fully load before reading it.

---

## Architecture (for developers)

The project is a **monorepo** — a single repository containing both the frontend and backend.

```
language-finder/
├── client/               # Vite + React frontend (deployed to any static host)
│   └── src/
│       ├── App.jsx                    # State orchestrator
│       ├── hooks/useJobPoller.js      # Async job-polling hook
│       └── components/
│           ├── DomainInput.jsx        # Domain entry form
│           ├── ProgressView.jsx       # Live progress bar
│           ├── ResultsTable.jsx       # Results grid + CSV export
│           └── SidePanel.jsx         # Context / help panel
└── server/               # Node.js + Express API (deployed to Render)
    ├── index.js                       # Entry point, CORS, rate limiting
    ├── engine/
    │   ├── crawler.js                 # Playwright BFS crawler + 4 detection strategies
    │   └── aggregator.js              # ISO code → human-readable result shape
    ├── routes/api.js                  # Job endpoints (POST / GET)
    └── services/jobStore.js           # In-memory job store with TTL eviction
```

### Job flow

```
User submits domains
       │
       ▼
POST /api/jobs  →  job queued, jobId returned
       │
       ▼
Server crawls domains asynchronously (one at a time)
       │
       ▼
Client polls GET /api/jobs/:id every 2 s for progress
       │
       ▼
GET /api/jobs/:id/results  →  results table rendered + CSV available
```

---

## Local development

### Prerequisites

- Node.js 18+
- npm 9+

### 1 — Install all dependencies

```bash
npm run install:all
```

### 2 — Configure environment

```bash
cp .env.example .env
```

The defaults work out of the box for local development — no changes needed.

### 3 — Start both servers

```bash
npm run dev
```

This runs the Vite dev server on **port 5173** and the Express API on **port 3001** simultaneously. The Vite dev proxy forwards all `/api` requests to Express, so no CORS configuration is needed locally.

---

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `PORT` | Server | Port Express listens on (set automatically by Render) |
| `ALLOWED_ORIGIN` | Server | Comma-separated list of allowed frontend origins — set to your production frontend URL |
| `VITE_API_URL` | Client | API base URL — leave empty in dev (proxy handles it); set to your Render API URL in production |

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jobs` | Submit an array of domains (max 50). Returns `{ jobId }`. |
| `GET` | `/api/jobs/:id` | Poll status. Returns `{ status, progress, current, total }`. |
| `GET` | `/api/jobs/:id/results` | Fetch results once `status === "complete"`. |
| `GET` | `/health` | Health check — returns `{ status: "ok" }`. |

The `POST /api/jobs` endpoint is rate-limited per IP address.

---

## Deployment

### Backend — Render

The backend is deployed on **[Render](https://render.com)**. Configuration lives in [`render.yaml`](render.yaml).

**Setup steps:**

1. Connect your GitHub repository to Render.
2. Render auto-detects `render.yaml` and configures the service.
3. Set `ALLOWED_ORIGIN` in the Render dashboard to your frontend URL (e.g., `https://your-app.netlify.app`).
4. Deploy — Render runs [`server/render-build.sh`](server/render-build.sh), which installs dependencies and downloads the Chromium binary.

### Frontend — any static host

The client builds to a standard `dist/` folder and can be deployed to Netlify, Vercel, GitHub Pages, or any CDN. Set the `VITE_API_URL` build variable to your Render API URL.

---

## Detection methodology

For each domain Leximeter runs up to **four detection strategies** in sequence:

| # | Strategy | What it checks |
|---|---|---|
| 1 | HTML `lang` attribute | `<html lang="es">` on every page visited |
| 2 | `hreflang` link tags | `<link rel="alternate" hreflang="fr">` declarations |
| 3 | URL path & subdomain signals | Path prefixes like `/es/`, full names like `/french/`, and subdomains like `es.example.com` |
| 4 | Proactive path probing | Fires lightweight HEAD requests against canonical language paths (e.g. `/es`, `/french`) when strategies 1–3 find nothing — skipped when hreflang tags are already present |

**SPA support:** when a React, Next.js, or Nuxt site is detected, Leximeter waits for JavaScript hydration before reading the DOM.

**Review Recommended** is set to **Yes** when: no languages are found, a crawl error occurred, or a single-page app returned only one language (which may indicate incomplete hydration).

---

## Built by

[Tremaine McKinley](https://github.com/tremckinley)
