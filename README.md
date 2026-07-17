# GisViz — Frontend

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Docker · Cloudflare · IONOS VPS

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Repository layout](#2-repository-layout)
3. [Prerequisites](#3-prerequisites)
4. [Environment variables](#4-environment-variables)
5. [Local development](#5-local-development)
6. [Key pages and components](#6-key-pages-and-components)
7. [Production deployment](#7-production-deployment)
8. [CI/CD — GitHub Actions](#8-cicd--github-actions)
9. [Monitoring](#9-monitoring)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Architecture

```
Browser → Cloudflare Edge (TLS :443)
        → IONOS VPS :443
        → Caddy (reverse proxy)
        → Docker container: gisviz-frontend :3000
        → Next.js standalone server (node server.js)
```

The frontend is a Next.js 15 App Router application built with `output: 'standalone'`. It is compiled into a Docker image and served via Caddy behind Cloudflare.

`NEXT_PUBLIC_*` environment variables are **baked into the JS bundle at build time** via Docker build args. Changing them requires a rebuild.

### Dockerfile stages

| Stage | Base | Purpose | Used by |
|---|---|---|---|
| `base` | node:20-slim | Install node_modules | All stages |
| `dev` | base | Hot-reload dev server | `docker-compose.dev.yml` |
| `builder` | base | `next build` with env args baked in | Production |
| `prod` | node:20-slim | Run `node server.js`, non-root user | `docker-compose.yml` |

---

## 2. Repository layout

```
gisviz-frontend/
├── app/
│   ├── about/page.tsx           # About page (uses LegalPage CMS component)
│   ├── admin/                   # Admin panel (control, analytics, ERD, activity)
│   ├── auth/page.tsx            # Login / register
│   ├── components/
│   │   ├── Feed.tsx             # Main feed — stream + trending tabs, snap scroll
│   │   ├── FloatingSearch.tsx   # Search trigger bar
│   │   ├── SearchOverlay.tsx    # Smart search panel (pops up or down)
│   │   ├── Navbar.tsx           # Top navigation
│   │   ├── Sidebar.tsx          # Right sidebar — categories, publishers, footer links
│   │   ├── SharePost.tsx        # Share modal
│   │   └── ReportPost.tsx       # Report modal
│   ├── legal/
│   │   ├── LegalPage.tsx        # Shared CMS component — fetches content from backend
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── cookies/page.tsx
│   │   └── accessibility/page.tsx
│   ├── post/
│   │   ├── [id]/page.tsx        # Post detail page
│   │   ├── [id]/edit/page.tsx   # Edit post
│   │   └── upload/page.tsx      # Upload + image validation
│   ├── profile/[handle]/page.tsx # User profile — posts + bookmarks tabs
│   ├── settings/                 # Account settings
│   ├── layout.tsx               # Root layout — fonts, auth provider, navbar
│   └── page.tsx                 # Home — Feed + Sidebar + FloatingSearch
├── context/
│   └── AuthContext.tsx          # JWT auth state, login/logout, refreshProfile
├── services/
│   └── api.ts                   # All API calls — axios instance, TTL cache
├── public/
│   ├── robots.txt
│   └── sitemap.xml              # Static sitemap (dynamic one in app/sitemap.ts)
├── app/sitemap.ts               # Dynamic sitemap — fetches slugs from backend
├── .env.frontend.example        # Template — copy to .env.frontend, never commit
├── docker-compose.yml           # Production
├── docker-compose.dev.yml       # Development (hot-reload)
├── Dockerfile
├── next.config.js               # output: 'standalone' required
└── tailwind.config.js
```

---

## 3. Prerequisites

### Local development

| Tool | Version |
|---|---|
| Node.js | 20 LTS |
| npm | 10+ |
| Docker | 24+ (for docker compose) |
| Git | any |

### Production (IONOS VPS)

| Tool | Purpose |
|---|---|
| Docker 24+ | Container runtime |
| Caddy 2 | Reverse proxy + TLS termination |
| Cloudflare | CDN, DDoS, SSL edge |

---

## 4. Environment variables

Copy the example and fill in values. **Never commit `.env.frontend`.**

```bash
cp .env.frontend.example .env.frontend
```

### `.env.frontend` reference

```bash
# URL the browser uses to reach the FastAPI backend
# Dev:  http://localhost:8001
# Prod: https://api.gisviz.com
NEXT_PUBLIC_API_URL=https://api.gisviz.com

# Google Analytics 4 Measurement ID
# Only loads in NODE_ENV=production — safe to leave blank in dev
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Baked into JS bundle at build time |
| `NEXT_PUBLIC_GA_ID` | No | Only loads when `NODE_ENV=production` |

> **Important:** `NEXT_PUBLIC_*` variables are visible in the browser. Never put secrets here.

### Environment file matrix

| File | Committed | Used in | Purpose |
|---|---|---|---|
| `.env.frontend` | No | VPS prod build | Real API URL + GA ID |
| `.env.frontend.dev` | No | Local dev | Local API URL, no GA |
| `.env.frontend.example` | Yes | Onboarding | Template with placeholders |

---

## 5. Local development

```bash
# 1. Clone and enter
git clone git@github.com:YOUR_ORG/gisviz-frontend.git
cd gisviz-frontend

# 2. Create local env file
cp .env.frontend.example .env.frontend
# Edit:
#   NEXT_PUBLIC_API_URL=http://localhost:8001
#   NEXT_PUBLIC_GA_ID=   (leave blank)

# 3. Start the backend first (in a separate terminal)
cd ../gisviz-backend
docker compose -f docker-compose.dev.yml up
# Wait for: "Application startup complete"

# 4a. Run frontend with Docker (hot-reload via volume mount)
docker compose -f docker-compose.dev.yml up
# App at: http://localhost:3001

# 4b. Or run natively (faster HMR)
npm install --legacy-peer-deps
npm run dev
# App at: http://localhost:3000
```

### Useful dev commands

```bash
npm run dev          # start dev server with hot-reload
npm run build        # production build (catches TypeScript + ESLint errors)
npm run start        # run the production build locally
npm run lint         # ESLint check
```

---

## 6. Key pages and components

### `app/page.tsx` — Home

Renders the `<Feed>` component alongside `<Sidebar>` and `<FloatingSearch>`.

### `app/components/Feed.tsx`

Main feed component. Key behaviours:

- **Two tabs:** Stream (newest first, paginated) and Trending (top-N by engagement, no pagination)
- **Mobile movie view:** Single `snap-y snap-mandatory` scroll container. The header (tabs + Publish button) is the first snap point. Each post card is a snap point. Scrolling back to top reveals the header.
- **Desktop:** Natural document flow, no snapping.
- **Like / Bookmark:** Optimistic updates — UI flips immediately, server reconciles, reverts on failure.
- **Auth gate:** Like/Bookmark/Comment redirect unauthenticated users to `/auth`.

### `app/components/SearchOverlay.tsx`

Smart search panel:

- Triggered by `<FloatingSearch>` bar at bottom of feed column
- **Smart positioning:** Pops upward if more space above trigger, downward if more space below
- **Keyboard shortcuts** (`↑↓ ↵ Esc`) hidden on mobile (`hidden sm:flex`)
- Navigates to `/post/${post_id}` for post results, `/profile/${handle}` for user results
- 280ms debounce, min 3 characters, max 5 results per category

### `app/legal/LegalPage.tsx`

Shared CMS component used by all legal pages and the About page. Fetches content from `GET /legal/{slug}` on the backend (Redis-cached, 30-day TTL). Supports slugs: `about`, `privacy`, `terms`, `cookies`, `accessibility`.

### `context/AuthContext.tsx`

Wraps the whole app. Provides:
- `user` — current user object or null
- `isAuthenticated` — boolean
- `isLoading` — true during initial token check
- `login(token, user)` — stores JWT in localStorage as `gisviz_token`
- `logout()` — clears JWT and handle from localStorage
- `refreshProfile()` — re-fetches `/users/me` and updates context

### `services/api.ts`

All HTTP calls are centralised here. Uses Axios with:
- Base URL: `NEXT_PUBLIC_API_URL/api/v1`
- JWT auto-attached from `localStorage.gisviz_token` on every request
- In-memory TTL cache (30s stream, 2min trending, 10min categories)
- 401 interceptor auto-redirects to `/auth` and clears tokens
- `_uid()` suffix on cache keys prevents cross-user cache pollution

---

## 7. Production deployment

### First deployment

```bash
ssh deploy@YOUR_VPS_IP
cd /srv/gisviz/gisviz-frontend

# Ensure .env.frontend exists with production values
nano .env.frontend

# Build and start
docker compose build --no-cache
docker compose up -d

# Verify
docker ps | grep gisviz-frontend
curl -I https://gisviz.com
```

### Manual update (without CI/CD)

```bash
cd /srv/gisviz/gisviz-frontend
git pull origin main

# Always use --no-cache when NEXT_PUBLIC_* vars might have changed
docker compose down
docker compose build --no-cache
docker compose up -d

# Check logs
docker compose logs --tail 30
```

### Caddy configuration

Caddy is installed as a system service (`/etc/caddy/Caddyfile`), not a Docker container. It proxies public traffic to the frontend container — Caddy only runs in production, not in dev.

```caddy
gisviz.com, www.gisviz.com {
    tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key
    reverse_proxy localhost:3000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
}
```

```bash
# Validate before applying
sudo caddy validate --config /etc/caddy/Caddyfile

# Zero-downtime reload
sudo systemctl reload caddy
```

### Origin certificate (Cloudflare)

SSL/TLS mode: **Full (strict)**. The Cloudflare origin certificate must be installed on the VPS:

```
/etc/caddy/certs/origin.pem   # chmod 644
/etc/caddy/certs/origin.key   # chmod 600
```

---

## 8. CI/CD — GitHub Actions

Deployments are triggered by commit message keywords.

| Commit message contains | Deploys |
|---|---|
| `[deploy]` | Backend + Frontend |
| `[deploy-frontend]` | Frontend only |
| `[deploy-backend]` | Backend only |
| anything else | Nothing |

### Setup (one-time)

**1. Generate a CI/CD SSH key on your local machine:**

```bash
ssh-keygen -t ed25519 -C "gisviz-github-actions" -f ~/.ssh/gisviz_actions -N ""
```

**2. Add the public key to the VPS:**

```bash
ssh gisviz
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
```

**3. Add GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/gisviz_actions` (private key) |
| `VPS_SSH_PORT` | `22` |

**4. Create a `production` environment** (Settings → Environments).

### What the deploy script does on the VPS

1. `git pull origin main` — pulls latest code
2. `docker compose build --no-cache` — full image rebuild (required for `NEXT_PUBLIC_*` changes)
3. `docker compose up -d` — starts new container
4. Health check — `curl http://localhost:3000/` must return HTTP 200
5. `docker image prune -f` — removes old images to free disk
6. Posts a deploy status comment on the commit

Every successful deploy creates a release branch: `release/frontend-YYYYMMDD-HHMMSS-SHORTSHA`

### Example deploy commit

```bash
git add .
git commit -m "fix search overlay 404 on post results [deploy-frontend]"
git push origin main
# → workflow triggers, VPS pulls, rebuilds, restarts, health checks
```

---

## 9. Monitoring

| Tool | Access | Purpose |
|---|---|---|
| Portainer | `YOUR_VPS_IP:9000` | Container CPU/RAM, logs, restart |
| Google Analytics | analytics.google.com | Real user traffic, page views |
| Google Search Console | search.google.com/search-console | Indexing, search performance |
| UptimeRobot | uptimerobot.com | HTTPS availability, 5-min ping |
| Cloudflare Analytics | dash.cloudflare.com | Edge requests, cache hit rate |

### Quick checks

```bash
# Container running?
docker ps | grep gisviz-frontend

# Tail logs
docker compose logs -f

# Check NEXT_PUBLIC vars were baked in correctly
docker inspect gisviz-frontend | grep -A5 NEXT_PUBLIC
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 502 Bad Gateway | Container not running on `:3000` | `docker ps` — check port mapping |
| 403 from Cloudflare | SSL/TLS mode mismatch | Set Cloudflare to **Full (strict)** |
| GA4 not tracking | `NODE_ENV` not `production` | Verify `docker inspect` shows `NODE_ENV=production` |
| `NEXT_PUBLIC_*` vars empty | Build arg not passed or cached | Rebuild with `--no-cache` |
| Sitemap build fails | Fetch during static gen | Ensure `export const dynamic = 'force-dynamic'` in `app/sitemap.ts` |
| Container exits immediately | Missing standalone output | Check `next.config.js` has `output: 'standalone'` |
| Search results link to 404 | Wrong route in SearchOverlay | Posts navigate to `/post/${post_id}`, not `/p/${slug}` |
| Legal pages show stale content | Redis TTL not expired | Flush with `docker compose exec cache redis-cli DEL legal:*` on backend |
| ESLint fails during build | Config extension wrong | Use `eslint-config-next/core-web-vitals.js` in `eslint.config.mjs` |

---

## Security notes

- `.env.frontend` is gitignored — never commit it
- `.dockerignore` excludes `.env*`, `node_modules`, `.git` — build context is ~2MB
- `NEXT_PUBLIC_*` vars are intentionally public — visible in browser source
- Non-root user `nextjs:nodejs` runs inside the production container
- GA4 only loads when `NODE_ENV === 'production'` — never in dev or test
- Cloudflare proxies all traffic — VPS IP is not publicly exposed
