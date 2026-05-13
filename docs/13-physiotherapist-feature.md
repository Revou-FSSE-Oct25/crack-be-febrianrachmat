# Physiotherapist Feature (Step 5)

This feature handles therapist profile completion, patient browsing, and admin verification.

## Why this matters

- Ensures only verified therapists are visible to patients.
- Creates a clear trust workflow (`PENDING -> APPROVED/REJECTED`).
- Keeps therapist onboarding separated from admin moderation.

## Endpoints

All endpoints require JWT.

### Therapist Endpoints

#### `GET /physiotherapists/me` (Role: `PHYSIOTHERAPIST`)
Get therapist's own profile data.

#### `PATCH /physiotherapists/me` (Role: `PHYSIOTHERAPIST`)
Update professional profile fields.

Request example:

```json
{
  "categoryId": "uuid-category",
  "bio": "Focused on post-injury rehabilitation and mobility recovery.",
  "education": "S1 Fisioterapi Universitas X",
  "experienceYears": 4,
  "certificationUrl": "https://example.com/certificates/pt-001",
  "licenseNumber": "SIP-PT-001",
  "consultationFee": 150000,
  "clinicAddress": "Jl. Sudirman No. 10, Jakarta"
}
```

Important behavior:
- Any profile update resets verification to `PENDING` for re-review.

#### `POST /physiotherapists/me/online` (Role: `PHYSIOTHERAPIST`)
Lightweight **presence heartbeat** (no body). Sets `onlineUntil` on the
caller's profile to approximately **now + 5 minutes**. The therapist SPA
should call this about once per minute while a dashboard tab is open so
patients can filter "online now" in browse.

### Patient/Admin Browse Endpoint

#### `GET /physiotherapists` (Roles: `PATIENT`, `ADMIN`)
Browse approved therapists only.

Query params:
- `categoryId` (optional, UUID)
- `search` (optional)
- `onlineNow` (optional boolean): when `true`, only therapists whose
  `onlineUntil` is still in the future are returned
- `page` (default `1`)
- `limit` (default `10`, max `50`)

Response shape:

```json
{
  "page": 1,
  "limit": 10,
  "total": 25,
  "totalPages": 3,
  "items": []
}
```

Each item includes `onlineUntil` when set (ISO timestamp). Clients can treat
`onlineUntil > now()` as a green "online" badge.

### Admin Verification Endpoints

#### `GET /admin/physiotherapists/pending` (Role: `ADMIN`)
List all therapists waiting for verification.

#### `PATCH /admin/physiotherapists/:profileId/verify` (Role: `ADMIN`)
Approve or reject therapist profile.

Request example:

```json
{
  "status": "APPROVED"
}
```

or

```json
{
  "status": "REJECTED",
  "rejectionReason": "License document is unclear, please re-upload."
}
```

Validation rules:
- Admin can only set `APPROVED` or `REJECTED`.
- `rejectionReason` is required when status is `REJECTED`.

## Database relation involved

- `PhysiotherapistProfile` belongs to `User`.
- `PhysiotherapistProfile` can reference one `Category`.
- `verificationStatus`, `rejectionReason`, `verifiedAt` are managed by admin flow.
- `onlineUntil` supports the optional "online now" browse filter (Phase 2).
