# ============================================================
# Multi-stage Dockerfile for MCE Workspace (mce-workspace)
# ============================================================
# Stage 1: Install dependencies (with BuildKit pnpm store cache)
# Stage 2: Build the application (Vite + esbuild)
# Stage 3: Production runtime
#
# IMPORTANT: Enable BuildKit for fast incremental builds:
#   DOCKER_BUILDKIT=1 docker compose build
# Or add to docker-compose.yml:
#   x-build-args: &build-args
#     BUILDKIT_INLINE_CACHE: "1"
# ============================================================

# ---- Stage 1: Dependencies ----
FROM node:22-slim AS deps
# Install pnpm via npm (faster than corepack which downloads from internet)
RUN npm install -g pnpm@10.4.1 --quiet
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
# Use BuildKit cache mount for pnpm store — avoids re-downloading on every build
# The github: tarball for @oe-ecosystem/ai-agent is cached here after first download
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline || \
    pnpm install --no-frozen-lockfile --prefer-offline || \
    pnpm install --no-frozen-lockfile

# ---- Stage 2: Build ----
FROM node:22-slim AS build
RUN npm install -g pnpm@10.4.1 --quiet
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Allow subpath base to be injected at build time (e.g. /workspace for nginx routing)
ARG VITE_BASE_PATH=/workspace
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
# Mapbox token — baked into the client bundle at build time
ARG VITE_MAPBOX_TOKEN=
ENV VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN}
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
RUN npm install -g pnpm@10.4.1 drizzle-kit --quiet

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
