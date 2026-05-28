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
Create review for own completed **booking** or **consultation**.

Rules:
- send exactly one of `bookingId` or `consultationId`
- target must belong to patient
- booking status must be `COMPLETED`, or consultation status must be `COMPLETED`
- only one review per booking or per consultation per patient

Booking request:

```json
{
  "bookingId": "uuid-booking",
  "rating": 5,
  "comment": "Sangat membantu dan profesional."
}
```

Consultation request:

```json
{
  "consultationId": "uuid-consultation",
  "rating": 5,
  "comment": "Konsultasi online sangat jelas dan responsif."
}
```

Responses include `sourceType`: `BOOKING` or `CONSULTATION`.
Review payload also includes fairness metadata:
- `editableUntil` (timestamp window end for patient edit/delete)
- `isEditableByPatient` (derived flag from moderation state + 72h window)

### `GET /reviews/me` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
List reviews based on current user scope.

### `GET /physiotherapists/:physiotherapistId/reviews` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)
List public reviews (`isHidden = false`) for selected therapist.

### `PATCH /reviews/:reviewId` (Role: `PATIENT`)
Update own review. At least one of `rating` or `comment` must be sent.

Fairness guards:
- review can only be edited within **72 hours** after submission
- hidden/moderated reviews cannot be edited by patient
- comment is normalized (`trim`); empty string clears comment to `null`

Request:

```json
{
  "rating": 4,
  "comment": "Sesi kedua juga sangat membantu."
}
```

Send `comment: ""` to clear the comment text.

### `DELETE /reviews/:reviewId` (Role: `PATIENT`)
Delete own review.

Fairness guards:
- review can only be deleted within **72 hours** after submission
- hidden/moderated reviews cannot be deleted by patient

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
- bookings and consultations total / by status
- transactions by status, paid revenue, refund total
- reviews: total, visible, hidden, average rating, distribution, by source (booking vs consultation)
- audit log total count

### `GET /admin/dashboard/analytics?days=30` (Role: `ADMIN`)

Extended analytics for charts (7–90 days, default 30):

- daily trends: new users, bookings, consultations, paid revenue
- review distribution and average rating
- payment mix (booking vs consultation PAID counts and revenue)
- top 5 therapists by average visible review rating
- audit log entries in the selected period

## Database relations involved

- `Review` links `Booking`, `PatientProfile`, and `PhysiotherapistProfile`
- Analytics reads aggregate data from `User`, `PhysiotherapistProfile`, `Booking`, `Transaction`, and `Review`
