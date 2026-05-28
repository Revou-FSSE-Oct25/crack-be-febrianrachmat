# Business Error Codes

This document defines API-level business error codes returned in `error.errorCode` by `GlobalExceptionFilter`.

## Why this matters

- Makes frontend error handling deterministic (no brittle string matching).
- Keeps user-facing messages human-friendly while preserving machine-readable semantics.
- Aligns API/UX behavior across modules.

## Error envelope

Error responses include:

```json
{
  "success": false,
  "timestamp": "2026-05-28T08:00:00.000Z",
  "path": "/bookings",
  "error": {
    "code": 400,
    "errorCode": "SLOT_UNAVAILABLE",
    "message": "Selected slot is no longer available.",
    "details": {}
  }
}
```

## Current business codes

- `SLOT_UNAVAILABLE`
  - Slot cannot be used (already taken, overlap, already started/passed, etc).
- `BOOKING_LOCKED`
  - Booking/slot mutation is blocked due to lifecycle lock (active booking, invalid state for reschedule, etc).
- `INVALID_TIME_WINDOW`
  - Invalid time window input (`start >= end`, non-future start, etc).
- `RESOURCE_NOT_FOUND`
  - Resource is not found (or intentionally hidden by ownership hardening).
- `CHAT_LOCKED`
  - Chat cannot send/open because consultation is not in `IN_PROGRESS`.
- `REVIEW_DUPLICATE`
  - Review already exists for that booking/consultation target.
- `REVIEW_LOCKED`
  - Review mutation blocked due to moderation lock or expired edit window.
- `TRANSACTION_STATE_INVALID`
  - Transaction action invalid for current status.
- `PAYMENT_PROOF_REQUIRED`
  - Payment proof is required for payment confirmation flow.
- `INVALID_FILTER`
  - Filter combination is invalid (for example min value > max value).
- `CATEGORY_NOT_FOUND`
  - Requested category reference does not exist.
- `PROFILE_NOT_FOUND`
  - Physiotherapist profile is not found (or hidden by visibility constraints).
- `VERIFICATION_INVALID`
  - Admin verification payload is invalid for requested status transition.
- `CATEGORY_DUPLICATE`
  - Category name already exists.
- `CATEGORY_IN_USE`
  - Category cannot be deleted because it is still referenced by physiotherapist profiles.
- `PATIENT_PROFILE_NOT_FOUND`
  - Patient profile is not found for current user context.
- `NOTIFICATION_NOT_FOUND`
  - Notification is not found (or not owned by the requesting user).
- `TARGET_USER_NOT_FOUND`
  - Target user for direct notification does not exist.
- `REGISTRATION_ROLE_FORBIDDEN`
  - Public/OAuth registration attempted to create forbidden role (for example admin).
- `EMAIL_ALREADY_REGISTERED`
  - Email is already registered.
- `OAUTH_CONFIG_MISSING`
  - OAuth redirect config is missing (`FRONTEND_URL` not set).
- `USER_NOT_FOUND`
  - User record is not found.
- `AVATAR_NOT_FOUND`
  - Avatar is missing (no upload yet or file not present on server).
- `AVATAR_PATH_INVALID`
  - Avatar path is invalid or unsafe.
- `ACCOUNT_STATE_INVALID`
  - Account action is invalid for current account state.
- `PASSWORD_CHANGE_INVALID`
  - Password change request is invalid (for example new password equals current password).
- `PASSWORD_UNAVAILABLE`
  - Password-based operation is not available for social-login-only account.

## Notes

- `errorCode` is optional for non-business failures (generic validation, infra, unhandled errors).
- New business cases should add a stable code before shipping frontend logic that depends on it.
