# ==========================================
# 1. BASE STAGE (Debian Slim)
# ==========================================
FROM node:20-slim AS base
WORKDIR /app

COPY package*.json ./

RUN npm cache clean --force && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --legacy-peer-deps

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
RUN npm run build
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