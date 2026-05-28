# Consultation, Booking, and Dummy Transaction

This module encodes the two distinct paid journeys in the product:

- **Consultation** — paid **online chat** session (Halodoc-style chat with
  a verified physiotherapist). Pay-first model: chat unlocks only after the
  patient has paid and the admin confirms the dummy transaction.
- **Booking** — paid **physical appointment** (clinic visit or home visit),
  typically scheduled as a follow-up after the online consultation.

A `Transaction` is the shared payment artefact and is linked to **exactly one**
of: a `Booking` or a `Consultation`.

## Why this matters

- Encodes real business flow with role-based transitions.
- Keeps payment simulation explicit without external gateway complexity.
- Forces ownership and status validation on every state transition.

---

## Consultation lifecycle (pay-first)

```
REQUESTED         patient created the request
   |
   | therapist accepts
   v
ACCEPTED          therapist agreed; patient may now pay
   |
   | admin confirms transaction PAID
   v
IN_PROGRESS       chat unlocked (sessionStartedAt recorded)
   |
   | patient/therapist marks session done
   v
COMPLETED
```

`CANCELLED` is reachable from any non-terminal status:

- Patient cancels before paying (`REQUESTED`/`ACCEPTED` → `CANCELLED`).
- Admin refunds a paid consultation (`IN_PROGRESS` → `CANCELLED`).

`IN_PROGRESS` is only ever set automatically by the payment confirmation
flow — it cannot be set directly through the status endpoint (admin override
excepted) so a session can never start without paying.

## Consultation Endpoints

### `POST /consultations` (Role: `PATIENT`)

Create a consultation request. The current `consultationFee` of the chosen
therapist is **snapshotted** into `Consultation.feeSnapshot` so the patient's
price doesn't change retroactively if the therapist later updates their
profile fee.

### `GET /consultations/me` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

List consultations by current actor.

### `PATCH /consultations/:consultationId/status` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

Update status with role + transition constraints:

- `PHYSIOTHERAPIST`: `ACCEPTED`, `COMPLETED`, `CANCELLED`
- `PATIENT`: `CANCELLED` always; `COMPLETED` only when currently `IN_PROGRESS`
- `ADMIN`: unrestricted role override, still subject to the transition matrix
- `IN_PROGRESS` cannot be set through this endpoint (admin excepted) — it is
  only set automatically when the linked transaction is marked `PAID`.

Allowed transitions:

| From | To |
|---|---|
| `REQUESTED` | `ACCEPTED`, `CANCELLED` |
| `ACCEPTED` | `IN_PROGRESS` (auto via pay), `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `COMPLETED`, `CANCELLED` | (terminal) |

---

## Booking Endpoints

### `POST /bookings` (Role: `PATIENT`)

Create booking for an approved therapist (physical visit).

Rules:

- `CLINIC_VISIT` requires `clinicAddress`
- `HOME_VISIT` requires `homeVisitAddress`
- Optional `slotId` must belong to selected therapist and be available
- If `slotId` is provided, `appointmentDate` is synchronized to slot `startTime`
- If both `slotId` and `appointmentDate` are provided, they must match exactly
- If `slotId` is not provided, `appointmentDate` is required
- Booking from a consultation is blocked when consultation is `CANCELLED`
- If slot is used, it becomes unavailable

### `GET /bookings/me` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

List bookings by current actor.

### `PATCH /bookings/:bookingId/status` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

Update booking status:

- `PHYSIOTHERAPIST`: `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`
- `PATIENT`: `CANCELLED`
- `ADMIN`: can set any target status, but still must follow transition flow

If booking is cancelled, the linked slot is released back to available.
Valid transition flow: `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED`; cancel
is only allowed before completion.

### `PATCH /bookings/:bookingId/reschedule` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

Reschedule a booking while it is still active for planning (`PENDING` / `CONFIRMED`).

Rules:

- Cannot reschedule `IN_PROGRESS`, `COMPLETED`, or `CANCELLED` bookings
- `slotId` optional: if provided, must belong to the booking therapist, must still be available, and must start in the future
- `appointmentDate` optional when `slotId` exists (if sent, must equal slot `startTime`)
- Without `slotId`, `appointmentDate` is required and must be in the future
- Slot reassignment is atomic: claim new slot first, then release old slot

---

## Dummy Transaction Endpoints

A `Transaction` references **either** `bookingId` or `consultationId`, never
both. The service layer enforces this XOR rule.

### `POST /transactions` (Role: `PATIENT`)

Create a pending transaction. Body must include exactly one of:

```json
{ "bookingId": "uuid", "paymentMethod": "BANK_TRANSFER", "paymentProofUrl": "https://..." }
```

or

```json
{ "consultationId": "uuid", "paymentMethod": "BANK_TRANSFER", "paymentProofUrl": "https://..." }
```

`amount` is **always computed on the server** from `visitFeeSnapshot` (booking) or
`feeSnapshot` (consultation). Clients must not send `amount`.

Booking-path rules:

- Booking must be `CONFIRMED`, `IN_PROGRESS`, or `COMPLETED` (not `PENDING` / `CANCELLED`).
- Payment proof required (multipart `proof` and/or `paymentProofUrl` https).
- Only one `PENDING` or `PAID` transaction per booking (DB-enforced).

Consultation-path rules:

- The consultation must be in `ACCEPTED` status (therapist has agreed).
- Only one `PENDING` or `PAID` transaction may exist per consultation (DB-enforced).

### `GET /transactions/:transactionId/payment-proof` (Role: `PATIENT` owner or `ADMIN`)

Streams uploaded proof files (auth required). External `https://` proofs redirect.
Public `/uploads/...` static serving is **disabled**.

### `PATCH /admin/transactions/:transactionId/pay` (Role: `ADMIN`)

Confirm a pending dummy payment (`PENDING → PAID`). Side-effect: if the
transaction is linked to a consultation, the consultation is auto-promoted
`ACCEPTED → IN_PROGRESS` so the chat unlocks.

> Note: there is **no** patient-side self-confirm endpoint. Patients cannot
> mark their own transactions as paid; only `ADMIN` can perform the dummy
> confirmation. This mirrors a real payment-gateway callback, where the
> server (not the buyer) updates the status.

### `PATCH /admin/transactions/:transactionId/refund` (Role: `ADMIN`)

Simulate refund (`PAID → REFUNDED`) with required reason. Side-effect: if
the transaction is linked to a consultation that is `ACCEPTED` or
`IN_PROGRESS`, that consultation is auto-`CANCELLED`, which re-locks chat.

### `GET /transactions` (Roles: `ADMIN`, `PATIENT`)

List transactions (patient sees own, admin sees all).

---

## Database relations involved

- `Consultation` links `PatientProfile` and `PhysiotherapistProfile`, holds
  `feeSnapshot`, `acceptedAt`, `startedAt`, `completedAt` timestamps.
- `Booking` links patient + therapist (+ optional consultation/slot).
- `Transaction` links to **either** `Booking` or `Consultation`, plus
  `patient`. Indexed by both `(bookingId, status)` and
  `(consultationId, status)`.

---

## Phase 3: Consultation SLA tier and auto-refund

Each consultation stores `slaTier`: `STANDARD` (default) or `FAST_ONLINE`.

- **STANDARD**: after the session is **paid** and moves to `IN_PROGRESS`, the
  therapist must send at least one chat message within
  `CONSULTATION_SLA_STANDARD_MINUTES` (default **1440** = 24 hours), measured
  from `startedAt`.
- **FAST_ONLINE**: same rule but
  `CONSULTATION_SLA_FAST_MINUTES` (default **10**). The API only allows this
  tier when the therapist has `onlineUntil` **after** the request time at
  consultation **create** time.

If the deadline passes with **no** therapist-authored message since
`startedAt`, a scheduled job calls admin refund on the linked paid
transaction (Indonesian auto-reason), cancels the consultation, and notifies
patient and therapist.

### Environment

| Variable | Meaning |
| -------- | ------- |
| `CONSULTATION_SLA_CRON` | Set to `false` to disable the cron (e.g. tests). Default: enabled. |
| `CONSULTATION_SLA_STANDARD_MINUTES` | SLA window for `STANDARD` (default 1440). |
| `CONSULTATION_SLA_FAST_MINUTES` | SLA window for `FAST_ONLINE` (default 10). |

### API

`POST /consultations` accepts optional `slaTier`. Omitted or `STANDARD` keeps
default; `FAST_ONLINE` is rejected with 400 if the therapist is not online at
create time.
