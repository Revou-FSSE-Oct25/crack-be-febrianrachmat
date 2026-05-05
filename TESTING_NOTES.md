# Testing Notes

Quick map of automated test coverage currently available in this repository.

## How to run tests

- Run all tests: `npm test`
- Type-check/build check: `npm run build`

## Current test coverage map

### Auth / RBAC

- `src/auth/guards/roles.guard.spec.ts`
  - Role authorization checks in `RolesGuard`.
- `src/auth/auth.e2e.spec.ts`
  - E2E-lite smoke coverage for public auth endpoints (`register`, `login`) with validation pipe enabled.
  - Protected route smoke coverage for `GET /auth/me` using a mock auth guard.

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
  - E2E-lite smoke coverage for protected listing endpoints (`GET /bookings/me`, `GET /consultations/me`) with auth guard mock and pagination forwarding checks.

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
  - auth -> create slot -> create booking -> transaction -> notification.
- Negative-path tests for more role/ownership edge cases in controller layer.
- Optional: coverage threshold in Jest config to enforce minimum baseline.
