# Notification Feature (Step 12)

This step adds in-app notifications for all roles.

## Why this matters

- Keeps users informed about booking, consultation, and moderation events.
- Supports admin communication for announcements or policy updates.
- Provides a scalable API-based notification flow without real-time complexity.

## Endpoints

All endpoints require JWT.

### `GET /notifications/me` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

List current user notifications with pagination.

Query:
- `page` default `1`
- `limit` default `10`

### `PATCH /notifications/:notificationId/read` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

Mark one notification as read (only if owned by current user).

### `PATCH /notifications/read-all` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

Mark all unread notifications as read for current user.

### `POST /admin/notifications/users/:userId` (Role: `ADMIN`)

Send notification to one user.

Request body:

```json
{
  "title": "Booking Updated",
  "body": "Your booking has been confirmed by physiotherapist."
}
```

### `POST /admin/notifications/broadcast` (Role: `ADMIN`)

Send the same notification to all active users.

## Database relation involved

- `Notification` belongs to one `User`.
- Each user can have many notifications.
