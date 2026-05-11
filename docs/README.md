# Documentation Index

Single source of truth for everything written about this backend.
All technical writeups previously scattered at the repo root now live here, grouped by category.

## How to read this

- File names start with a 2-digit prefix so they sort logically:
  - `0x` — Foundation (architecture, runtime, contracts)
  - `1x` — Feature documentation (one file per domain module)
  - `3x` — Quality (hardening, testing notes)
- Open files in numeric order if you are new to the project.
- Open files by category if you are looking up a specific topic.

---

## 0x. Foundation

Things that apply to every feature.

| File | Topic |
|---|---|
| [`01-backend-foundation.md`](./01-backend-foundation.md) | NestJS bootstrap, Prisma wiring, health endpoint, env template. |
| [`02-database-schema.md`](./02-database-schema.md) | Prisma data model: entities, relations, design decisions. |
| [`03-response-standardization.md`](./03-response-standardization.md) | Success envelope (`{ success, data, meta }`) and error envelope. |
| [`04-swagger-api-docs.md`](./04-swagger-api-docs.md) | Where to find OpenAPI docs and how to authorize from Swagger UI. |

## 1x. Features

One file per domain module. Each file lists endpoints, payloads, validation rules, and the relations involved.

| File | Module | Roles |
|---|---|---|
| [`10-auth-feature.md`](./10-auth-feature.md) | Auth (`/auth/*`) — register, login, me | Public + JWT |
| [`11-user-profile-feature.md`](./11-user-profile-feature.md) | Users (`/users/*`) — profile, change password | All roles |
| [`12-category-feature.md`](./12-category-feature.md) | Categories (`/categories`, `/admin/categories/*`) | Admin write, all read |
| [`13-physiotherapist-feature.md`](./13-physiotherapist-feature.md) | Physiotherapists (`/physiotherapists/*`, `/admin/physiotherapists/*`) | Therapist + Admin verification |
| [`14-availability-slots-feature.md`](./14-availability-slots-feature.md) | Availability slots (`/physiotherapists/me/availability-slots`, public list) | Therapist write, all read |
| [`15-booking-transaction-feature.md`](./15-booking-transaction-feature.md) | Consultations, Bookings, Transactions (incl. admin-only payment confirmation + refund) | Patient + Therapist + Admin |
| [`16-chat-feature.md`](./16-chat-feature.md) | Chat (`/chat/conversations/*`) — REST messaging tied to consultation | All roles, participant-scoped |
| [`17-review-analytics-feature.md`](./17-review-analytics-feature.md) | Reviews + admin moderation + dashboard analytics | All roles |
| [`18-notification-feature.md`](./18-notification-feature.md) | Notifications CRUD (`/notifications/*`, admin send/broadcast) | All roles |
| [`19-notification-automation-feature.md`](./19-notification-automation-feature.md) | Automated system notifications wired into business events | Internal |

## 3x. Quality

How the API is hardened and tested.

| File | Topic |
|---|---|
| [`30-hardening-testing-baseline.md`](./30-hardening-testing-baseline.md) | Global exception filter, health resilience, pagination DTO, first unit tests. |
| [`31-testing-notes.md`](./31-testing-notes.md) | Full automated-test coverage map (unit + controller + e2e-lite + real integration) and how to run them. |

---

## Quick reference

- **Run the API**: see `01-backend-foundation.md`.
- **Authenticate from Postman/Swagger**: see `10-auth-feature.md` + `04-swagger-api-docs.md`.
- **Understand the data model**: see `02-database-schema.md`.
- **Run tests / check coverage**: see `31-testing-notes.md`.
