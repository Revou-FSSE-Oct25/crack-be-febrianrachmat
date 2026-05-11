# User Profile Feature (Step 4)

This feature handles shared user account actions after login.

## Why this matters

- Every role needs a reliable self-service profile endpoint.
- Password change is critical account security.
- A single shared module avoids duplicated logic across roles.

## Endpoints

All endpoints below require JWT:
- `Authorization: Bearer <token>`

### `GET /users/me`

Returns current user profile data.

Response:

```json
{
  "id": "uuid",
  "fullName": "Rachmad Febrian",
  "email": "rachmad@example.com",
  "phoneNumber": "08123456789",
  "role": "PATIENT",
  "isActive": true,
  "createdAt": "2026-04-10T12:00:00.000Z",
  "updatedAt": "2026-04-10T12:00:00.000Z"
}
```

### `PATCH /users/me`

Update basic profile fields.

Request body:

```json
{
  "fullName": "Rachmad F.",
  "phoneNumber": "08999999999"
}
```

Response:

```json
{
  "id": "uuid",
  "fullName": "Rachmad F.",
  "email": "rachmad@example.com",
  "phoneNumber": "08999999999",
  "role": "PATIENT",
  "isActive": true,
  "updatedAt": "2026-04-10T12:30:00.000Z"
}
```

### `PATCH /users/change-password`

Change account password safely.

Request body:

```json
{
  "currentPassword": "password123",
  "newPassword": "newPassword123"
}
```

Response:

```json
{
  "message": "Password changed successfully."
}
```

## Validation and security rules

- `fullName` min 3 chars.
- `phoneNumber` min 8 chars.
- Password min 8 chars.
- New password must be different from current password.
- Current password must match stored hash.
