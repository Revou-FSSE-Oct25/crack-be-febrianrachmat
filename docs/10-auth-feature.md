# Auth Feature (Step 3)

This feature provides secure authentication for your Booking Management System.

## Why this matters

- Authentication is the front door of your API.
- JWT makes every request stateless and scalable for production.
- Role payload in JWT enables role-based authorization in later modules.

## Endpoints

### `POST /auth/register` (Public)

Create account for `PATIENT` or `PHYSIOTHERAPIST`.

Request body:

```json
{
  "fullName": "Rachmad Febrian",
  "email": "rachmad@example.com",
  "password": "password123",
  "phoneNumber": "08123456789",
  "role": "PATIENT"
}
```

Response:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "uuid",
    "fullName": "Rachmad Febrian",
    "email": "rachmad@example.com",
    "role": "PATIENT",
    "isActive": true
  }
}
```

### `POST /auth/login` (Public)

Login using email and password.

Request body:

```json
{
  "email": "rachmad@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "uuid",
    "fullName": "Rachmad Febrian",
    "email": "rachmad@example.com",
    "role": "PATIENT",
    "isActive": true
  }
}
```

### `GET /auth/me` (Protected)

Returns JWT payload from current access token.

Headers:
- `Authorization: Bearer <token>`

Response:

```json
{
  "sub": "uuid",
  "email": "rachmad@example.com",
  "role": "PATIENT",
  "iat": 1712750000,
  "exp": 1712836400
}
```

## Database relations involved

- `User` is always created during registration.
- If role is `PATIENT`, a related `PatientProfile` is created.
- If role is `PHYSIOTHERAPIST`, a related `PhysiotherapistProfile` is created with default values.

## Security notes

- Passwords are hashed with `bcryptjs`.
- Duplicate email registration is rejected.
- Public registration cannot create `ADMIN`.
- Global JWT guard protects all routes by default; use `@Public()` only for open routes.
