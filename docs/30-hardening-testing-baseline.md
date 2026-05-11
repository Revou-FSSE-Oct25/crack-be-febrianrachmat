# Hardening and Testing Baseline (Step 10)

This step improves API reliability and prepares test-driven iteration.

## What was hardened

### 1) Global exception response format

Added `GlobalExceptionFilter` so API errors have a consistent shape:

```json
{
  "success": false,
  "timestamp": "2026-04-11T00:00:00.000Z",
  "path": "/bookings",
  "error": {
    "code": 400,
    "message": "Validation failed",
    "details": {}
  }
}
```

### 2) Health endpoint resilience

- `GET /health` is now public.
- If DB is down, API returns:

```json
{
  "status": "degraded",
  "database": "disconnected"
}
```

This helps monitoring distinguish API uptime from DB availability.

### 3) Reusable pagination DTO

Added `PaginationQueryDto` and applied to list endpoints:
- consultations
- bookings
- transactions
- reviews
- chat conversations/messages

Query format:
- `page` default `1`
- `limit` default `10` (max `100`)

## Testing baseline

### Added tooling

- `jest`, `ts-jest`, `@types/jest`, `@nestjs/testing`, `supertest`
- `jest.config.ts`
- scripts:
  - `npm test`
  - `npm run test:watch`

### First unit tests

- `src/health/health.controller.spec.ts`
  - tests healthy and degraded DB states
- `src/auth/guards/roles.guard.spec.ts`
  - tests allow/deny behavior for role checks
