# ---- Stage 1: Dependencies ----
FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 2: Build ----
FROM deps AS builder
COPY . .
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

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy built output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy entrypoint and fix CRLF line endings (Windows checkout safety)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN dos2unix /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
