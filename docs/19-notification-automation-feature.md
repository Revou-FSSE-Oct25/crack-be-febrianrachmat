# Notification Automation Feature (Step 13)

This step connects business events to automatic in-app notifications.

## Why this matters

- Users receive important updates without relying on manual admin actions.
- Improves product feedback loop for booking, payment, moderation, and verification.
- Keeps notification delivery separated from domain logic through a shared service.

## Automated events implemented

### Consultation and Booking

- When patient creates consultation:
  - Notify physiotherapist about new consultation request.
- When consultation status changes:
  - If updated by physiotherapist, notify patient.
  - If cancelled by patient, notify physiotherapist.
- When patient creates booking:
  - Notify physiotherapist about new booking request.
- When booking status changes by physiotherapist/admin:
  - Notify patient.

### Transactions (Dummy Payment)

- When patient marks transaction as paid:
  - Notify patient payment success.
- When admin refunds transaction:
  - Notify patient with refund reason.

### Reviews and Moderation

- When patient creates review:
  - Notify physiotherapist about new review and rating.
- When admin moderates review:
  - Notify patient whether review is hidden or visible again.

### Physiotherapist Verification

- When admin approves/rejects physiotherapist profile:
  - Notify physiotherapist about final verification result.

## Implementation notes

- Added reusable helper: `NotificationsService.createSystemNotification`.
- Notification failures are wrapped safely (`safeNotify`) so business operations
  remain successful even if notification insert fails.
