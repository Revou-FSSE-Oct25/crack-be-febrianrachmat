# Testing Notes

Quick map of automated test coverage currently available in this repository.

## How to run tests

- Run all tests: `npm test`
- Type-check/build check: `npm run build`

## Current test coverage map

### Auth / RBAC

- `src/auth/guards/roles.guard.spec.ts`
  - Role authorization checks in `RolesGuard`.

### Response shaping

- `src/common/interceptors/transform-response.interceptor.spec.ts`
  - Global success envelope and pagination response normalization.

### Health

- `src/health/health.controller.spec.ts`
  - Basic health endpoint behavior.

### Booking + transaction domain

- `src/bookings/bookings.service.spec.ts`
  - Booking status transition guards.
  - Booking creation validations (`slotId`, `appointmentDate`, consultation linkage/status).
  - Slot release behavior on cancellation.
  - Role-based listing behavior for patient/therapist/admin.
  - Transaction flow checks (create, pay, refund guards).
  - Notification failure tolerance (core flow still succeeds).

### Availability slots domain

- `src/availability-slots/availability-slots.service.spec.ts`
  - Slot creation validation (date window + overlap guard).
  - Update and delete guards when active bookings exist.
  - Listing behavior (pagination, date filters, upcoming + available constraints).

### Notifications domain

- `src/notifications/notifications.service.spec.ts`
  - List/read/read-all behavior.
  - Ownership checks for mark-as-read.
  - Admin send/broadcast behaviors.
  - System notification helper behavior.

## Known test gaps (next candidates)

- Controller-level tests for key modules (`bookings`, `availability-slots`, `notifications`).
- Integration/e2e flow tests across modules:
  - auth -> create slot -> create booking -> transaction -> notification.
- Negative-path tests for more role/ownership edge cases in controller layer.
- Optional: coverage threshold in Jest config to enforce minimum baseline.
