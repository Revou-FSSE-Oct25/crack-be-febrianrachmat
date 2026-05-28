# Availability Slots Feature

Therapists publish time windows; patients pick a `slotId` when creating a booking (see `BOOKING_TRANSACTION_FEATURE.md`).

## Why this matters

- Booking flow already validates `slotId` and toggles `isAvailable`; this module completes the missing CRUD for therapists and a read API for patients.

## Rules (business logic)

- **`slotDate`** must match the **UTC calendar day** of **`startTime`** and **`endTime`** (all ISO 8601 strings).
- **Overlap**: a therapist cannot create or move a slot so its `[startTime, endTime)` overlaps another slot for the same therapist.
- **Create/update window**: `startTime` must be in the future (cannot publish or move slot to a past start).
- **Public list**: only **approved** therapists; only slots with `isAvailable: true` and **`startTime >= now`**.
- **Active booking** (status ≠ `CANCELLED`): therapist cannot change slot times, cannot mark `isAvailable: true`, cannot delete the slot.

## Endpoints

All endpoints require JWT unless noted otherwise (all require JWT here).

### Therapist — manage own slots

| Method | Path | Role |
|--------|------|------|
| `POST` | `/physiotherapists/me/availability-slots` | `PHYSIOTHERAPIST` |
| `GET` | `/physiotherapists/me/availability-slots` | `PHYSIOTHERAPIST` |
| `PATCH` | `/physiotherapists/me/availability-slots/:slotId` | `PHYSIOTHERAPIST` |
| `DELETE` | `/physiotherapists/me/availability-slots/:slotId` | `PHYSIOTHERAPIST` |

**Create body**

```json
{
  "slotDate": "2026-05-15",
  "startTime": "2026-05-15T02:00:00.000Z",
  "endTime": "2026-05-15T03:00:00.000Z"
}
```

**List query (mine)** — pagination (`page`, `limit`) plus optional `from`, `to` (ISO date/datetime; filters `slotDate`).

**Update body** — optional fields: `slotDate`, `startTime`, `endTime`, `isAvailable`.

### Patient / others — browse bookable slots

`GET /physiotherapists/:profileId/availability-slots`

Roles: `PATIENT`, `ADMIN`, `PHYSIOTHERAPIST`

Returns paginated **upcoming, available** slots for an **approved** therapist profile. Same query params as list mine (`page`, `limit`, optional `from` / `to` on `slotDate`).

## Response shape

List endpoints return the standard pagination object (`items`, `page`, `limit`, `total`, `totalPages`) transformed by `TransformResponseInterceptor` into `{ success, data, meta }`.
