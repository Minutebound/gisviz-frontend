# gisviz — Frontend README

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Lucide React

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Repository layout](#2-repository-layout)
3. [Prerequisites](#3-prerequisites)
4. [Environment variables](#4-environment-variables)
5. [Development setup (local Ubuntu)](#5-development-setup-local-ubuntu)
6. [Key pages and components](#6-key-pages-and-components)
7. [Production build and deployment (IONOS VPS)](#7-production-build-and-deployment-ionos-vps)
8. [Deploying with Docker (optional)](#8-deploying-with-docker-optional)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture overview

```
Browser
   │
   ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router)                                         │
│                                                                   │
│  app/                                                             │
│  ├── page.tsx              ← Feed (global publications)           │
│  ├── [id]/page.tsx         ← Single post detail                   │
│  ├── add-post/page.tsx     ← Upload + quality validation          │
│  ├── profile/[handle]/     ← User profile + saved posts           │
│  ├── auth/                 ← Login / register                     │
│  └── components/           ← Feed, Navbar, Sidebar                │
│                                                                   │
│  services/api.ts           ← All HTTP calls to FastAPI backend    │
│  hooks/useSavedPosts.ts    ← LocalStorage persistence hook        │
│  lib/imageValidation.ts    ← Client-side blur + dimension check   │
│  context/AuthContext.tsx   ← JWT auth state provider              │
└──────────────────────────────────────────────────────────────────┘
           │  HTTP/HTTPS
           ▼
  FastAPI backend  :8001
  (or https://api.yourdomain.com in prod)
```

### Data flow on the Feed page

```
User opens /
     │
     ▼
Feed.tsx mounts
     │
     ├── gisvizApi.fetchGlobalStream()  →  GET /api/v1/publications
     │        │
     │        ▼
     │   FastAPI → PostGIS query → JSON response
     │
     ├── Posts rendered with like/save/comment buttons
     │
     ├── handleLike()  →  POST /api/v1/publications/{id}/like
     │   (optimistic update → server reconciliation)
     │
     └── handleSave()  →  localStorage (useSavedPosts hook)
              │
              └── Reflected in Profile /profile/{handle} → Saved tab
```

### Image upload flow (Add Post page)

```
User selects file
     │
     ▼
validateImageQuality()   ← lib/imageValidation.ts
 ├── MIME type check (jpeg/png/webp only)
 ├── File size check  (max 10 MB)
 ├── Dimension check  (min 800×600)
 └── Laplacian blur score (threshold: 100)
     │
     ├── FAIL → show error, block submit
     │
     └── PASS → show green badge (dimensions + sharpness)
               │
               ▼
         User submits form
               │
               ▼
         gisvizApi.uploadVisual(file)
         →  POST /api/v1/publications/post/upload-visual
               │
               ▼
         gisvizApi.createPost({...})
         →  POST /api/v1/publications
               │
               ▼
         router.push(`/post/${postRes.post_id}`)
```

---

## 2. Repository layout

```
gisviz-frontend/
├── app/
│   ├── [id]/
│   │   └── page.tsx            # publication detail page
│   ├── add-post/
│   │   └── page.tsx            # upload page (image validation + form)
│   ├── auth/
│   │   └── page.tsx            # login / register
│   ├── profile/
│   │   └── [handle]/
│   │       └── page.tsx        # user profile + Posts + Saved tabs
│   ├── components/
│   │   ├── Feed.tsx            # global feed (like, save, share buttons)
│   │   ├── Navbar.tsx          # top navigation bar
│   │   ├── Sidebar.tsx         # right sidebar (follow suggestions etc.)
│   │   ├── SharePost.tsx       # share modal
│   │   └── ReportPost.tsx      # report modal
│   ├── layout.tsx              # root layout (AuthContext provider)
│   ├── page.tsx                # home page (renders Feed)
│   └── api.ts                  # route handlers (if any)
│
├── context/
│   └── AuthContext.tsx         # JWT auth state, login/logout helpers
│
├── hooks/
│   └── useSavedPosts.ts        # localStorage saved posts per-user
│
├── lib/
│   └── imageValidation.ts      # client-side image quality validator
│
├── services/
│   └── api.ts                  # all API calls to FastAPI backend
│
├── public/                     # static assets
├── .env.local.example          # template env file
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── FRONTEND_README.md          # this file
```

---

## 3. Prerequisites

### Development machine (Ubuntu 20.04 / 22.04 / 24.04)

| Tool | Version | Install |
|---|---|---|
| Node.js | 18 LTS or 20 LTS | See step 1 below |
| npm | 9+ (ships with Node) | — |
| Git | any | `sudo apt install git` |

### Production server (IONOS VPS Ubuntu 22.04)

| Tool | Purpose |
|---|---|
| Node.js 20 LTS | Build + serve Next.js (standalone) |
| PM2 | Process manager (keeps Next.js alive, restarts on crash) |
| Caddy 2 | Reverse proxy + automatic TLS |

---

## 4. Environment variables

Create `.env.local` in the frontend root:

```bash
cp .env.local.example .env.local
nano .env.local
```

```ini
# .env.local

# URL the browser uses to reach the FastAPI backend
# Dev: http://
# Prod: https://api.yourdomain.com
NEXT_PUBLIC_API_URL=http://
```

> **Important:** only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser bundle. Never put JWT secrets or database passwords here.

---

## 5. Development setup (local Ubuntu)

### Step 1 — Install Node.js 20 LTS via NVM (recommended)

NVM lets you switch Node versions per project without `sudo`.

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell
source ~/.bashrc   # or source ~/.zshrc

# Install and use Node 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x
```

### Step 2 — Clone and enter the frontend directory

```bash
git clone https://github.com/your-org/gisviz.git
cd gisviz/gisviz-frontend
```

### Step 3 — Install dependencies

```bash
npm install
```

### Step 4 — Create the environment file

```bash
cp .env.local.example .env.local
# Default value (http://) works if backend is running locally
```

### Step 5 — Start the backend first

The frontend makes API calls to the backend on startup (categories, feed). Start it in another terminal:

```bash
cd ../gisviz-backend
docker compose up
# Wait until you see: "Application startup complete" in the api logs
```

### Step 6 — Start the Next.js dev server

```bash
npm run dev
```

The app is now running at `http://localhost:3000` with hot-reload. Any change to a `.tsx` or `.ts` file reloads the browser automatically.

### Step 7 — Verify

```bash
open http://localhost:3000
# You should see the feed page.
# If the feed is empty, run: curl http:///seed
```

### Useful dev commands

```bash
npm run dev        # start dev server with hot-reload
npm run build      # production build (catches TypeScript errors)
npm run start      # run the production build locally
npm run lint       # ESLint check
npm run type-check # TypeScript type check without building
```

---

## 6. Key pages and components

### `app/page.tsx` — Home / Feed

Renders the `<Feed>` component. Passes `currentUserHandle` from `localStorage` so the feed knows whose saves to track.

### `app/components/Feed.tsx`

The main feed component. Key behaviours:

- Fetches publications via `gisvizApi.fetchGlobalStream(offset, limit)` on mount
- **Like button:** optimistic update (count changes immediately), then reconciles with server response. Redirects to `/login` if not authenticated.
- **Comments link:** navigates to `/{post_id}#comments`.
- **Share button:** copies share URL to clipboard.
- Action bar is a separate `<div>` **outside** the card `<Link>` to avoid nested interactive element problems.

### `app/post/upload/page.tsx`

Upload page (previously `/post/upload`, renamed to `/post/upload`):

- Client-side image validation runs on file select (`validateImageQuality()` from `lib/imageValidation.ts`)
- Submit button stays disabled until validation passes
- Shows green badge (dimensions + sharpness score) on valid image
- On submit: uploads file → creates post → redirects to post detail

### `app/profile/[handle]/page.tsx`

Profile page:

- "Posts" tab: publications authored by this user
- "Saved" tab: only visible on own profile (`localStorage.getItem('geomap_handle') === handle`), shows saved post IDs from `useSavedPosts`

### `context/AuthContext.tsx`

Wraps the whole app. Provides:
- `user` — current user object (null if not logged in)
- `isAuthenticated` — boolean
- `isLoading` — true during initial token check
- `login(token, user)` — stores JWT in localStorage
- `logout()` — clears JWT and user from localStorage

### `services/api.ts`

All HTTP calls are centralised here. Uses `fetch` with the `NEXT_PUBLIC_API_URL` base. JWT from `localStorage.getItem('geomap_token')` is automatically attached as `Authorization: Bearer <token>` on authenticated endpoints.

### `hooks/useSavedPosts.ts`

```typescript

### `lib/imageValidation.ts`

Client-side image quality validator. Checks:

| Check | Default threshold |
|---|---|
| MIME type | jpeg, png, webp only |
| File size | Max 10 MB |
| Width × Height | Min 800 × 600 |
| Blur (Laplacian variance) | Min score 100 |

Blur detection uses a 3×3 Laplacian filter applied to a downscaled (max 512px) grayscale canvas. Higher score = sharper image. Typical blurry photos score under 100; sharp photos score 500+.

---

## 7. Production build and deployment (IONOS VPS)

### Step 1 — SSH to the server and install Node.js

```bash
ssh deploy@YOUR_SERVER_IP

# Install NVM for the deploy user
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

### Step 2 — Install PM2

PM2 is the process manager that keeps Next.js running after you close the terminal and restarts it if it crashes.

```bash
npm install -g pm2
pm2 startup   # follow the printed command to enable auto-start on boot
```

### Step 3 — Clone the repository

```bash
cd /home/deploy
git clone https://github.com/your-org/gisviz.git
cd gisviz/gisviz-frontend
```

### Step 4 — Set production environment variables

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
EOF
```

### Step 5 — Install dependencies and build

```bash
npm install
npm run build
```

This outputs a production-optimised build to `.next/`. Check for any TypeScript or build errors here before proceeding.

### Step 6 — Start with PM2

```bash
pm2 start npm --name "gisviz-frontend" -- start -- -p 3000
pm2 save   # persist this process so it survives server reboots
```

Check it's running:

```bash
pm2 status
pm2 logs gisviz-frontend --lines 50
```

### Step 7 — Configure Caddy for the frontend

If Caddy isn't already installed (see backend README Step 2):

```bash
sudo nano /etc/caddy/Caddyfile
```

Add the frontend block:

```caddy
gisviz.yourdomain.com {
    reverse_proxy localhost:3000

    # Cache static Next.js assets aggressively
    @static path /_next/static/*
    header @static Cache-Control "public, max-age=31536000, immutable"

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-Frame-Options DENY
        -Server
    }
}
```

```bash
sudo systemctl restart caddy
```

Caddy handles TLS automatically. The frontend is now live at `https://gisviz.yourdomain.com`.

### Step 8 — Deploying updates

Every time you push new code:

```bash
# On the server
cd /home/deploy/gisviz/gisviz-frontend
git pull origin main
npm install          # picks up any new packages
npm run build        # rebuild
pm2 restart gisviz-frontend
```

For zero-downtime deploys with PM2:

```bash
pm2 reload gisviz-frontend   # graceful restart — waits for in-flight requests
```

### Step 9 — (Optional) Use Next.js standalone output

For a smaller, more portable deployment, enable standalone mode in `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

After `npm run build`, copy the standalone output and start directly with Node:

```bash
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
pm2 start .next/standalone/server.js --name "gisviz-frontend" -- -p 3000
```

Standalone output is ~40% smaller (no `node_modules` needed in production).

---

## 8. Deploying with Docker (optional)

If you prefer to containerise the frontend alongside the backend:

```dockerfile
# gisviz-frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

Add to `docker-compose.yml`:

```yaml
frontend:
  build:
    context: ../gisviz-frontend
    args:
      NEXT_PUBLIC_API_URL: "https://api.yourdomain.com"
  container_name: gisviz-frontend
  restart: always
  ports:
    - "3000:3000"
  networks:
    - gisviz-network
```

Then Caddy proxies `gisviz.yourdomain.com` → `localhost:3000` as normal.

---

## 9. Troubleshooting

### `NEXT_PUBLIC_API_URL is not defined`
The `.env.local` file doesn't exist or wasn't loaded. Create it from the example:
```bash
cp .env.local.example .env.local
```
Restart the dev server after changing env files.

### Feed shows "Could not load posts. Check your API connection."
The backend isn't running or isn't reachable. Verify:
```bash
curl http:///
# Should return: {"status":"operational",...}
```
If the backend is running in Docker, make sure you started it with `docker compose up` from the `gisviz-backend` directory.

### Like/save buttons not responding
This is usually a nested interactive element bug. The `Feed.tsx` action bar must be **outside** the card `<Link>` wrapper. Each button must have `type="button"`, `e.preventDefault()`, and `e.stopPropagation()` on its `onClick`.

### `Error: Cannot find module 'X'`
A package wasn't installed. Run:
```bash
npm install
```

### TypeScript errors during `npm run build`
Build errors show the file and line. Fix all TypeScript errors before deploying — the build will refuse to complete with type errors. Run:
```bash
npm run type-check
```
to see all errors at once without building.

### Images not loading in production
`NEXT_PUBLIC_API_URL` in `.env.local` points to `localhost` in dev. In production it must point to your real API domain (`https://api.yourdomain.com`). Rebuild after changing:
```bash
nano .env.local
npm run build
pm2 restart gisviz-frontend
```

### PM2 process shows "errored" status
```bash
pm2 logs gisviz-frontend --lines 100
```
Usually a port conflict or missing `.env.local`. Fix the issue then:
```bash
pm2 restart gisviz-frontend
```

### Port 3000 already in use
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```