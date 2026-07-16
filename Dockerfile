# ==========================================
# 1. BASE STAGE (Switched to Debian Slim)
# ==========================================
FROM node:20-slim AS base
WORKDIR /app

# Copy package files to leverage Docker layer caching
COPY package*.json ./

# Network-resilient npm install
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
COPY . .
RUN npm run build

# ==========================================
# 4. PROD STAGE (Ionos VPS - Debian Slim)
# ==========================================
FROM node:20-slim AS prod
WORKDIR /app
ENV NODE_ENV=production

# Copy ONLY the necessary compiled files from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3001
CMD ["npm", "start"]