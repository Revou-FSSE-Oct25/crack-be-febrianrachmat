[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/rF-k97Bx)

# Physiotherapy Booking — Backend API

Production-style backend for a physiotherapy booking platform inspired by Halodoc.
Built with **NestJS + Prisma + PostgreSQL**, three roles (`ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`), JWT auth, RBAC, REST chat, in-app notifications, and a dummy payment lifecycle.

| | |
| --- | --- |
| **Frontend (Next.js)** | [crack-fe-febrianrachmat](https://github.com/Revou-FSSE-Oct25/crack-fe-febrianrachmat) — produksi: https://crack-fe-febrianrachmat-production.up.railway.app |
| **Backend (repo ini)** | [crack-be-febrianrachmat](https://github.com/Revou-FSSE-Oct25/crack-be-febrianrachmat) |

> Full technical documentation lives under [`docs/`](./docs/README.md).
> If you are reviewing this project, start there.
>
> **Product & demo policy (Bahasa Indonesia):** [`docs/product-policy.md`](./docs/product-policy.md) — alur pembayaran, bukti bayar, privasi ringkas, disclaimer medis, dan batasan demo.

## Live API (Railway production)

| | URL |
| --- | --- |
| Base URL | https://crack-be-febrianrachmat-production.up.railway.app |
| Health check | https://crack-be-febrianrachmat-production.up.railway.app/health |
| Swagger / OpenAPI UI | https://crack-be-febrianrachmat-production.up.railway.app/docs |
| **Database ERD** (dbdiagram.io) | https://dbdiagram.io/d/Crack-Physio-6a05b6997a923b9472b2f884 |

Use the **Swagger** link to browse every endpoint, try requests, and authorize with a JWT from `POST /auth/login`. This is the backend URL to configure in the frontend (`NEXT_PUBLIC_API_URL` or equivalent), not the PostgreSQL connection string. The **ERD** link opens the interactive database diagram; source DBML also lives in [`docs/database-erd.dbml`](./docs/database-erd.dbml) (see [`docs/02-database-schema.md`](./docs/02-database-schema.md)).

---

## Tech stack

- **Runtime**: Node.js (TypeScript) + NestJS 11
- **ORM**: Prisma 6 → PostgreSQL
- **Auth**: JWT (Passport) + role-based guards (`@Roles()` + `RolesGuard`)
- **OAuth** (opsional): Google, GitHub, Facebook, Apple — redirect ke frontend `/auth/callback` dengan `accessToken`
- **Notifikasi**: in-app CRUD + otomasi dari booking/konsultasi/review; **email mock** (log konsol, bukan SMTP)
- **Validation**: `class-validator` + `class-transformer` + global `ValidationPipe`
- **Docs**: Swagger / OpenAPI at `GET /docs`
- **Testing**: Jest unit + controller delegation + e2e-lite + real integration suite
- **Deployment**: Railway (managed Postgres + Node service) — [live API](#live-api-railway-production)

## Repository layout

```
crack-be-febrianrachmat/
├── docs/                  # Full project documentation (start here)
├── prisma/                # schema.prisma, migrations, seed.ts
├── src/                   # NestJS modules (auth/oauth, users, bookings, notifications, ...)
├── .githooks/             # Optional local hook to keep commits author-only
├── package.json
├── prisma.config.ts
├── jest.config.js
└── jest.integration.config.js
```

## Quick start (local)

1. Install dependencies (this also runs `prisma generate` via `postinstall`):
   ```bash
   npm install
   ```
2. Copy and edit env:
   ```bash
   cp .env.example .env
   # set DATABASE_URL, JWT_SECRET, PORT
   # opsional: FRONTEND_URL, CORS_ORIGINS, OAuth provider keys (lihat .env.example)
   ```
3. Apply schema and seed demo data:
   ```bash
   npm run prisma:migrate     # dev migration
   npm run prisma:seed        # demo accounts + slots
   ```
4. Run the API:
   ```bash
   npm run start:dev
   ```
5. Open:
   - Health: http://localhost:3000/health
   - Swagger UI: http://localhost:3000/docs

### Demo accounts (after `prisma:seed`)

Default password (overridable with `SEED_DEFAULT_PASSWORD`): `password123`

| Email | Role |
|---|---|
| `admin@demo.local` | ADMIN |
| `patient1@demo.local` | PATIENT |
| `patient2@demo.local` | PATIENT |
| `physio1@demo.local` | PHYSIOTHERAPIST (APPROVED) |
| `physio2@demo.local` | PHYSIOTHERAPIST (APPROVED) |
| `physio3@demo.local` | PHYSIOTHERAPIST (PENDING — untuk uji verifikasi admin) |

Login OAuth membuat atau menautkan akun terpisah dari akun seed di atas.

## Environment (ringkasan)

Salin `.env.example` → `.env`. Variabel penting:

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | Signing JWT — **harus sama** dengan `JWT_SECRET` di frontend (untuk gate `/admin`) |
| `PORT` | Port HTTP (default `3000`) |
| `CORS_ORIGINS` / `FRONTEND_URL` | Wajib di produksi; origin frontend (pisah koma untuk beberapa URL) |
| `API_PUBLIC_URL` | Base URL publik API (callback OAuth), mis. URL Railway backend |
| `GOOGLE_*`, `GITHUB_*`, `FACEBOOK_*`, `APPLE_*` | Opsional — hanya provider yang di-set yang aktif (`GET /auth/oauth/providers`) |
| `EMAIL_MOCK_ENABLED` | Log email notifikasi ke konsol (`true`/`false`; default aktif kecuali `NODE_ENV=production`) |

## Fitur API (ringkas)

| Area | Endpoint utama |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, OAuth `GET /auth/oauth/:provider` |
| Notifikasi | `GET /notifications/me`, `GET /notifications/me/unread-count`, `PATCH .../read`, admin broadcast |
| Booking / konsultasi / bayar | Lihat Swagger `/docs` dan [`docs/15-booking-transaction-feature.md`](./docs/15-booking-transaction-feature.md) |

## Testing

| Command | What it runs |
|---|---|
| `npm test` | Unit + controller delegation + e2e-lite (mocked) |
| `npm run test:cov` | Unit suite with coverage report (`coverage/`, HTML di `coverage/lcov-report/index.html`) |
| `npm run test:integration` | Real integration suite against `TEST_DATABASE_URL` (no service mocks, runs serially) |
| `npm run test:all` | `npm test` then `npm run test:integration` |

For a coverage map, what each suite asserts, and how CI publishes coverage summaries, see [`docs/31-testing-notes.md`](./docs/31-testing-notes.md).

**CI:** setiap push/PR ke `main` menjalankan `test:cov`, `test:integration` (Postgres service di GitHub Actions), `build`, dan memposting tabel coverage di job summary (artefak `coverage-report` untuk unduhan).

## Deployment (Railway)

The deployed API for this repository is reachable at the URLs in [Live API (Railway production)](#live-api-railway-production) above.

1. Create Postgres + Node service in Railway, link the repo.
2. Set env vars in the Railway service:
   - `DATABASE_URL` → Postgres connection string from the linked DB.
   - `JWT_SECRET` → strong random secret (do **not** reuse the example).
   - `PORT` → Railway provides this; the app listens on `process.env.PORT`.
   - `CORS_ORIGINS` → URL frontend Railway (sama dengan yang dipakai browser).
   - `FRONTEND_URL` → URL frontend (redirect OAuth ke `/auth/callback`).
   - `API_PUBLIC_URL` → URL publik service backend ini (untuk callback provider OAuth).
   - Provider OAuth + `EMAIL_MOCK_ENABLED` sesuai kebutuhan (lihat `.env.example`).
3. Build/start commands (also set in-repo via [`railway.json`](./railway.json) so Railway always runs compile + correct start):
   - **Build**: `npm run build`
   - **Start**: `npm run start:prod`
   - `postinstall` automatically runs `prisma generate`.
4. After first deploy, apply schema (one-off, from Railway shell **or** locally with the public connection string):
   ```bash
   npm run prisma:migrate:deploy
   npm run prisma:seed       # optional — demo data
   ```

> Local Prisma CLI loads `.env` automatically via `prisma.config.ts` (`import 'dotenv/config'`).
> When running migrations against Railway from your laptop, use the **public** Postgres URL (e.g. `*.proxy.rlwy.net`); `*.railway.internal` only resolves inside Railway.

### Jika container crash dengan `MODULE_NOT_FOUND` / `cjs/loader`

Biasanya `dist/main.js` tidak ada karena **build TypeScript tidak pernah jalan** di tahap build Railway, atau `npm install` melewati devDependencies sehingga `tsc` tidak tersedia. Perbaikan di repo ini: `railway.json` memaksa `npm run build`, dan `typescript` dipasang sebagai **dependency** agar compiler selalu ada saat build. Setelah push, buka tab **Build Logs** (bukan hanya Runtime) dan pastikan baris `tsc` / `npm run build` sukses sebelum start.

## Documentation map

| Category | Where |
|---|---|
| **Product & demo policy** | [`docs/product-policy.md`](./docs/product-policy.md) |
| Foundation (NestJS, Prisma, response shape, Swagger, **ERD / DBML**) | [`docs/01..04`](./docs/README.md#0x-foundation) |
| Per-feature API + business rules | [`docs/10..19`](./docs/README.md#1x-features) |
| Hardening + testing + ops | [`docs/30..32`](./docs/README.md#3x-quality) |

## Conventions

- Every successful response is wrapped as `{ success, data, meta? }`; errors as `{ success: false, error, timestamp, path }` (see [`docs/03-response-standardization.md`](./docs/03-response-standardization.md)).
- All routes are JWT-protected by default; public endpoints are explicitly tagged with `@Public()`.
- Role checks use `@Roles(UserRole.X)` + the global `RolesGuard`; ownership is enforced at the service layer.
