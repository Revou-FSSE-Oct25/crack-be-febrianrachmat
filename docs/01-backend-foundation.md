# Backend Foundation (Step 2)

This step initializes the NestJS backend and connects Prisma so the project is ready for feature modules.

## Why we do this first

- Gives a stable project structure before building auth, users, and bookings.
- Ensures database connectivity can be verified early.
- Reduces debugging complexity later (small, testable setup).

## What was added

- Base NestJS app bootstrap:
  - `src/main.ts`
  - `src/app.module.ts`
- Prisma integration:
  - `src/prisma/prisma.module.ts`
  - `src/prisma/prisma.service.ts`
- Health endpoint:
  - `src/health/health.module.ts`
  - `src/health/health.controller.ts`
- TypeScript config:
  - `tsconfig.json`
  - `tsconfig.build.json`
- Environment template:
  - `.env.example`

## API endpoint (current)

### `GET /health`

Purpose: Check API and database availability.

Example response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## How to run

1. Copy `.env.example` to `.env`
2. Adjust `DATABASE_URL` for your PostgreSQL instance
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Run app in dev mode:
   - `npm run start:dev`
5. Test endpoint:
   - `GET http://localhost:3000/health`
