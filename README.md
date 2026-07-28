# Leximeter

**Leximeter** is a web diagnostic tool that identifies the languages present across a domain — useful for SEO audits and web accessibility reviews.

It performs a breadth-first crawl of up to five pages per domain, extracting `html lang` attributes, `hreflang` declarations, and language signals from URL paths. When a Single Page Application (SPA) is detected, it waits for framework hydration before reading the DOM.

---

## Architecture

The project is a **monorepo** with a React frontend and a Node/Express backend.

```
language-finder/
├── client/          # Vite + React frontend
│   └── src/
│       ├── App.jsx                    # State orchestrator
│       ├── hooks/useJobPoller.js      # Async job polling hook
│       └── components/
│           ├── DomainInput.jsx
│           ├── ProgressView.jsx
│           ├── ResultsTable.jsx
│           └── SidePanel.jsx
└── server/          # Express API + Playwright crawler
    ├── index.js                       # Entry point
    ├── engine/
    │   ├── crawler.js                 # Playwright BFS crawler
    │   └── aggregator.js              # Language code → result shape
    ├── routes/api.js                  # Job endpoints
    └── services/jobStore.js           # In-memory job store with TTL eviction
```

### Job Flow

1. User submits domains → `POST /api/jobs`
2. Server queues the job and starts `processDomains` asynchronously
3. Client polls `GET /api/jobs/:id` every 2 seconds
4. On completion, client fetches `GET /api/jobs/:id/results`
5. Results are displayed in a table and can be exported as CSV

---

## Local Development

### Prerequisites

- Node.js 18+
- npm 9+

### Install all dependencies

```bash
npm run install:all
```

### Start both servers

```bash
npm run dev
```

This runs both the Vite dev server (port `5173`) and the Express API (port `3001`) concurrently. The Vite dev proxy forwards all `/api` requests to the Express server, so no CORS configuration is needed locally.

---

## Environment Variables

Copy `.env.example` and fill in values as needed:

```bash
cp .env.example .env
```

| Variable | Used by | Description |
|---|---|---|
| `PORT` | Server | Port Express listens on (default: `3001`) |
| `ALLOWED_ORIGIN` | Server | CORS allowed origin — set to your frontend URL in production |
| `VITE_API_URL` | Client | API base URL — leave empty in dev (proxy handles it); set to your Render URL in production |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jobs` | Submit a list of domains (max 50). Returns `{ jobId }`. |
| `GET` | `/api/jobs/:id` | Poll job status. Returns `{ status, progress, current, total }`. |
| `GET` | `/api/jobs/:id/results` | Fetch results once status is `complete`. |
| `GET` | `/health` | Health check — returns `{ status: "ok" }`. |

### Rate Limiting

The `POST /api/jobs` endpoint is limited to **10 requests per IP per 15 minutes**.

---

## Deployment

The backend is deployed on **[Render](https://render.com)**. Configuration is in [`render.yaml`](render.yaml).

The build script ([`server/render-build.sh`](server/render-build.sh)) installs dependencies and downloads the Chromium binary used by Playwright.

### Render setup checklist

1. Connect your GitHub repository to Render.
2. Render will detect `render.yaml` automatically.
3. Set the `ALLOWED_ORIGIN` environment variable in the Render dashboard to your frontend URL (e.g., `https://your-app.netlify.app`).
4. Deploy.

The frontend can be deployed to any static host (Netlify, Vercel, GitHub Pages). Set `VITE_API_URL` to your Render API URL in the build environment.

---

## Methodology

Leximeter uses [Playwright](https://playwright.dev/) to render pages in a headless Chromium browser and [Cheerio](https://cheerio.js.org/) to parse the resulting HTML. For each domain it:

1. Visits up to 5 pages via breadth-first search, starting at the root.
2. Detects SPAs by checking for `#root`, `#app`, `#__next`, `__NEXT_DATA__`, etc., and waits for `networkidle` when found.
3. Extracts language signals from:
   - `<html lang="...">` attribute
   - `<link rel="alternate" hreflang="...">` tags
   - URL path segments (e.g., `/es/`, `/french/`)
4. Flags a domain for **manual review** if: no languages are found, an error occurred, or a SPA returned ≤ 1 language.

---

## Built by

[Tremaine McKinley](https://github.com/tremckinley)
