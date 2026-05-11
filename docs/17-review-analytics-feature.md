# Review and Analytics Feature (Step 9)

This step adds:
- patient review flow
- admin review moderation
- admin dashboard analytics endpoint

## Why this matters

- Reviews create trust and quality feedback.
- Moderation protects platform quality and safety.
- Analytics helps admin monitor platform health and business progress.

## Review Endpoints

All endpoints require JWT.

### `POST /reviews` (Role: `PATIENT`)
Create review for own completed booking.

Rules:
- booking must belong to patient
- booking status must be `COMPLETED`
- only one review per booking per patient

Request:

```json
{
  "bookingId": "uuid-booking",
  "rating": 5,
  "comment": "Sangat membantu dan profesional."
}
```

### `GET /reviews/me` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
List reviews based on current user scope.

### `GET /physiotherapists/:physiotherapistId/reviews` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
List public reviews (`isHidden = false`) for selected therapist.

### `DELETE /reviews/:reviewId` (Role: `PATIENT`)
Delete own review.

### `PATCH /admin/reviews/:reviewId/moderate` (Role: `ADMIN`)
Hide or unhide review and add moderation note.

Request:

```json
{
  "isHidden": true,
  "moderationNote": "Contains inappropriate language."
}
```

## Dashboard Analytics Endpoint

### `GET /admin/dashboard/overview` (Role: `ADMIN`)

Returns key overview metrics:
- users total / by role
- therapist verification counts
- bookings total / by status
- transactions by status
- total paid revenue and total refund amount
- review total and hidden count

## Database relations involved

- `Review` links `Booking`, `PatientProfile`, and `PhysiotherapistProfile`
- Analytics reads aggregate data from `User`, `PhysiotherapistProfile`, `Booking`, `Transaction`, and `Review`
