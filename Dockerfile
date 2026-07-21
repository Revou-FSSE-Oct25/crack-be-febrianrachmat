# syntax=docker/dockerfile:1.7

# ---- Stage 1: build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install OS deps yang sering dibutuhkan Prisma engine.
RUN apk add --no-cache openssl

# Install deps (termasuk devDeps) untuk build.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json ./
# Skip lifecycle scripts during install (postinstall prisma + prepare hooks)
# to reduce peak RAM on Railway/small builders (exit 137 = OOM).
ENV SKIP_PRISMA_POSTINSTALL=1
RUN npm ci --ignore-scripts
RUN npx prisma generate

# Salin source + scripts (build memanggil scripts/copy-i18n.mjs).
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV SKIP_PRISMA_POSTINSTALL=1

# Hanya butuh runtime deps + hasil build + prisma client.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci --omit=dev --ignore-scripts
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

# Migrate deploy runs every start. Seed only when Railway/env sets RUN_DB_SEED=true (once), then turn it off.
CMD ["./docker-entrypoint.sh"]
