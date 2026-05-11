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

### Patient/Admin Browse Endpoint

#### `GET /physiotherapists` (Roles: `PATIENT`, `ADMIN`)
Browse approved therapists only.

Query params:
- `categoryId` (optional, UUID)
- `search` (optional)
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
