[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/rF-k97Bx)

# Physiotherapy Booking — Backend API

Production-style backend for a physiotherapy booking platform inspired by Halodoc.
Built with **NestJS + Prisma + PostgreSQL**, three roles (`ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`), JWT auth, RBAC, REST chat, in-app notifications, and a dummy payment lifecycle.

> Full technical documentation lives under [`docs/`](./docs/README.md).
> If you are reviewing this project, start there.

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
- **Validation**: `class-validator` + `class-transformer` + global `ValidationPipe`
- **Docs**: Swagger / OpenAPI at `GET /docs`
- **Testing**: Jest unit + controller delegation + e2e-lite + real integration suite
- **Deployment**: Railway (managed Postgres + Node service) — [live API](#live-api-railway-production)

## Repository layout

```
crack-be-febrianrachmat/
├── docs/                  # Full project documentation (start here)
├── prisma/                # schema.prisma, migrations, seed.ts
├── src/                   # NestJS modules (auth, users, bookings, ...)
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

## Testing

| Command | What it runs |
|---|---|
| `npm test` | Unit + controller delegation + e2e-lite (mocked) |
| `npm run test:cov` | Unit suite with coverage report |
| `npm run test:integration` | Real integration suite against `TEST_DATABASE_URL` (no service mocks, runs serially) |
| `npm run test:all` | `npm test` then `npm run test:integration` |

For a coverage map, what each suite asserts, and the latest local results, see [`docs/31-testing-notes.md`](./docs/31-testing-notes.md).

## Deployment (Railway)

The deployed API for this repository is reachable at the URLs in [Live API (Railway production)](#live-api-railway-production) above.

1. Create Postgres + Node service in Railway, link the repo.
2. Set env vars in the Railway service:
   - `DATABASE_URL` → Postgres connection string from the linked DB.
   - `JWT_SECRET` → strong random secret (do **not** reuse the example).
   - `PORT` → Railway provides this; the app listens on `process.env.PORT`.
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
| Foundation (NestJS, Prisma, response shape, Swagger, **ERD / DBML**) | [`docs/01..04`](./docs/README.md#0x-foundation) |
| Per-feature API + business rules | [`docs/10..19`](./docs/README.md#1x-features) |
| Hardening + testing | [`docs/30..31`](./docs/README.md#3x-quality) |

## Conventions

- Every successful response is wrapped as `{ success, data, meta? }`; errors as `{ success: false, error, timestamp, path }` (see [`docs/03-response-standardization.md`](./docs/03-response-standardization.md)).
- All routes are JWT-protected by default; public endpoints are explicitly tagged with `@Public()`.
- Role checks use `@Roles(UserRole.X)` + the global `RolesGuard`; ownership is enforced at the service layer.
