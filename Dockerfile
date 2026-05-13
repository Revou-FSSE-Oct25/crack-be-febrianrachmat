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
RUN npm ci

# Salin source dan compile.
COPY src ./src
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Hanya butuh runtime deps + hasil build + prisma artifacts untuk migrate/seed.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

# `npm ci --omit=dev` melompat devDependencies; `postinstall` di package.json
# otomatis menjalankan `prisma generate` sehingga client siap pakai di runtime.
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

# Migrate deploy runs every start. Seed only when Railway/env sets RUN_DB_SEED=true (once), then turn it off.
CMD ["./docker-entrypoint.sh"]
