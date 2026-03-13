# ============================================================
# Multi-stage Dockerfile for MCE Ingestion Engine (mce-tools)
# ============================================================
# Stage 1: Install dependencies
# Stage 2: Build the application (Vite + esbuild)
# Stage 3: Production runtime
# ============================================================

# ---- Stage 1: Dependencies ----
FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# ---- Stage 2: Build ----
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build client (Vite → dist/public/) + server (esbuild → dist/index.js)
RUN pnpm build

# ---- Stage 3: Production ----
FROM node:22-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dos2unix \
    netcat-openbsd \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
# Install drizzle-kit globally for migrations
RUN npm install -g drizzle-kit

WORKDIR /app

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Copy drizzle config + migrations
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

# Copy server source for tsx-based migration scripts
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script and fix CRLF line endings (Windows checkout)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN dos2unix /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Environment defaults
ENV NODE_ENV=production

# The port is dynamic — Express picks it up from PORT env
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
