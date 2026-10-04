# syntax=docker/dockerfile:1.7
# ==========================================
# 1. BASE STAGE (Debian Slim)
# ==========================================
FROM node:20-slim AS base
WORKDIR /app

# Only package files first: this layer (the slow npm install) is reused until package.json / lock change.
COPY package*.json ./

# The npm download cache lives in a BuildKit cache mount, so it survives between builds: when package.json
# changes only the new packages are downloaded. (No "npm cache clean" — that threw the cache away every time.)
# `npm cache verify` drops damaged cache entries first (an interrupted build can leave some behind, and npm then
# re-downloads them with "tarball data ... seems to be corrupted" on every build).
RUN --mount=type=cache,target=/root/.npm \
    npm cache verify >/dev/null && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --legacy-peer-deps --prefer-offline --no-audit --no-fund

# ==========================================
# 2. DEV STAGE (Local Windows PC)
# ==========================================
FROM base AS dev
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ==========================================
# 3. BUILDER STAGE (Compiling Production)
# ==========================================
FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID

ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
# reuse Next's compile cache between builds too
RUN --mount=type=cache,target=/app/.next/cache npm run build
# ==========================================
# 4. PROD STAGE (Ionos VPS - Debian Slim)
# ==========================================
FROM node:20-slim AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 nextjs

# Standalone output only — no node_modules needed, image stays ~200MB
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]