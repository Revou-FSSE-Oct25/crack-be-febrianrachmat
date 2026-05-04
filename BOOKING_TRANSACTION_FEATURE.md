# Consultation, Booking, and Dummy Transaction (Step 7)

This step implements the core patient journey:
- create consultation
- create booking
- simulate payment and refund

## Why this matters

- Encodes real business flow with role-based transitions.
- Keeps payment simulation explicit without external gateway complexity.
- Ensures actions are validated against ownership and status.

## Consultation Endpoints

### `POST /consultations` (Role: `PATIENT`)
Create consultation request.

### `GET /consultations/me` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
List consultations by current actor.

### `PATCH /consultations/:consultationId/status` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
Update status with role constraints:
- `PHYSIOTHERAPIST`: `ACCEPTED`, `REJECTED`, `COMPLETED`
- `PATIENT`: `CANCELLED`
- `ADMIN`: unrestricted override

## Booking Endpoints

### `POST /bookings` (Role: `PATIENT`)
Create booking for approved therapist.

Rules:
- `CLINIC_VISIT` requires `clinicAddress`
- `HOME_VISIT` requires `homeVisitAddress`
- Optional `slotId` must belong to selected therapist and be available
- If slot is used, it becomes unavailable

### `GET /bookings/me` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
List bookings by current actor.

### `PATCH /bookings/:bookingId/status` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
Update booking status:
- `PHYSIOTHERAPIST`: `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`
- `PATIENT`: `CANCELLED`
- `ADMIN`: unrestricted override

If booking is cancelled, linked slot is released to available again.

## Dummy Transaction Endpoints

### `POST /transactions` (Role: `PATIENT`)
Create pending transaction for own booking.

### `PATCH /transactions/:transactionId/pay` (Role: `PATIENT`)
Simulate successful payment (`PENDING -> PAID`).

### `PATCH /admin/transactions/:transactionId/refund` (Role: `ADMIN`)
Simulate refund (`PAID -> REFUNDED`) with required reason.

### `GET /transactions` (Roles: `ADMIN`, `PATIENT`)
List transactions (patient sees own, admin sees all).

## Database relation involved

- `Consultation` links `PatientProfile` and `PhysiotherapistProfile`
- `Booking` links patient + therapist (+ optional consultation/slot)
- `Transaction` links booking + patient
