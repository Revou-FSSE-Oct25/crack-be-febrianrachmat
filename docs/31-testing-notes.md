# Testing Notes

Quick map of automated test coverage currently available in this repository.

## How to run tests

- Unit + e2e-lite (mocked, fast): `npm test`
  - The unit Jest config now ignores `*.integration.spec.ts`, so this run never touches the database.
- Type-check / build check: `npm run build`
- Real integration tests (no service mocks, hits a real Postgres): `npm run test:integration`
  - Requires `TEST_DATABASE_URL` (or `DATABASE_URL`) pointing at a **dedicated test database**. Do **not** point this at production data.
  - Always runs serially (`--runInBand`) to avoid `40P01` deadlocks during `TRUNCATE ... CASCADE`.
- Both stages, sequentially: `npm run test:all`
- Unit test coverage report: `npm run test:cov`
- Seed demo data locally: `npm run prisma:seed`
- **CI (GitHub Actions):** push/PR ke `main` menjalankan `npm test` + `npm run build` (lihat [`32-operations-runbook.md`](./32-operations-runbook.md)).

## Latest local results (example)

- `npm test` (unit + e2e-lite): 14 suites, 79 tests ✅
- `npm run test:integration`: 1 suite, ~22 tests against a dedicated test DB ✅ (run locally before submission)
- `npm run test:cov` (unit/e2e-lite only): ~77% statements / ~55% branches / ~70% functions / ~76% lines on the latest local run

## Current test coverage map

### Auth / RBAC

- `src/auth/guards/roles.guard.spec.ts`
  - Role authorization checks in `RolesGuard`.
- `src/auth/auth.e2e.spec.ts`
  - E2E-lite smoke coverage for public auth endpoints (`register`, `login`) with validation pipe enabled.
  - Protected route smoke coverage for `GET /auth/me` using a mock auth guard.
- `src/integration/auth.integration.spec.ts`
  - Real integration flows (no service mocks) using `AppModule` + real database:
    - `register -> login -> /auth/me`
    - patient `create consultation -> create booking` with approved therapist.
    - booking transaction lifecycle: `create transaction -> admin pay -> admin refund`.
    - cross-module happy path: `slot -> consultation -> booking(slot) -> chat -> payment -> notifications -> notifications/read-all`.
    - status transition chain: consultation `ACCEPTED`, booking `CONFIRMED -> IN_PROGRESS -> COMPLETED`, and completed booking cannot be cancelled (`400`).
    - RBAC negative paths (`describe('RBAC negative paths')`):
      - patient: admin refund, admin dashboard, broadcast notification, create availability slot.
      - physiotherapist: create consultation, mark transaction paid (admin-only endpoint).
    - Ownership negative path (`describe('Ownership negative paths')`):
      - patient A cannot mark patient B notification as read (`404 Notification not found`).
      - patient A cannot update patient B booking status (`403 You can only update your own bookings`).
      - patient A cannot cancel patient B consultation (`403 You can only update your own consultations`).
      - patient A cannot create a transaction on patient B booking (`400 Booking not found for current patient`).
      - therapist A cannot update therapist B consultation (`403 You can only update your own consultations`).
      - therapist A cannot update therapist B booking (`403 You can only update your own bookings`).
      - therapist A cannot update/delete therapist B availability slot (`404 Availability slot not found`).
      - patient outsider cannot read/send messages in another user's chat conversation (`403 You are not part of this conversation`).
      - patient outsider cannot create/get conversation from another user's consultation (`403 You are not part of this consultation`).

### Response shaping

- `src/common/interceptors/transform-response.interceptor.spec.ts`
  - Global success envelope and pagination response normalization.

### Health

- `src/health/health.controller.spec.ts`
  - Basic health endpoint behavior.
- `src/health/health.e2e.spec.ts`
  - E2E-lite smoke coverage for `/health` response in connected/degraded database scenarios.

### Booking + transaction domain

- `src/bookings/bookings.service.spec.ts`
  - Booking status transition guards.
  - Booking creation validations (`slotId`, `appointmentDate`, consultation linkage/status).
  - Slot release behavior on cancellation.
  - Role-based listing behavior for patient/therapist/admin.
  - Transaction flow checks (create, pay, refund guards).
  - Notification failure tolerance (core flow still succeeds).
- `src/bookings/bookings.controller.spec.ts`
  - Controller delegation coverage for key consultation/booking/transaction endpoints.
- `src/bookings/bookings.e2e.spec.ts`
  - E2E-lite smoke coverage for protected endpoints (`GET /bookings/me`, `GET /consultations/me`, `GET /transactions`, `PATCH /bookings/:bookingId/status`) with auth guard mock and parameter forwarding checks.

### Availability slots domain

- `src/availability-slots/availability-slots.service.spec.ts`
  - Slot creation validation (date window + overlap guard).
  - Update and delete guards when active bookings exist.
  - Listing behavior (pagination, date filters, upcoming + available constraints).
- `src/availability-slots/availability-slots.controller.spec.ts`
  - Controller delegation coverage for create/list/update/delete/profile-list endpoints.
- `src/availability-slots/availability-slots.e2e.spec.ts`
  - E2E-lite smoke coverage for public slot listing endpoint (`GET /physiotherapists/:profileId/availability-slots`) with auth guard mock and query forwarding checks.

### Notifications domain

- `src/notifications/notifications.service.spec.ts`
  - List/read/read-all behavior.
  - Ownership checks for mark-as-read.
  - Admin send/broadcast behaviors.
  - System notification helper behavior.
- `src/notifications/notifications.controller.spec.ts`
  - Controller delegation coverage for list/read/read-all/send/broadcast endpoints.
- `src/notifications/notifications.e2e.spec.ts`
  - E2E-lite smoke coverage for protected notifications read flow (`GET /notifications/me`, `PATCH /notifications/read-all`) using mock auth guard.

## Known test gaps (next candidates)

- Deeper integration/e2e flow tests across modules:
  - auth -> consultation status transitions -> booking status transitions -> transaction refund -> notifications read-all (including mark-all).
- Negative-path tests for more role/ownership edge cases (remaining candidate: admin moderation edge behavior in chat participants/messages, if business rule needed).
- Optional: coverage threshold in Jest config to enforce minimum baseline.
