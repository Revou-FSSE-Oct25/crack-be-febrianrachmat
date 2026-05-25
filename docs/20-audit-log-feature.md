# Audit Log Feature

Persisted audit trail in PostgreSQL for sensitive admin and system actions.

## Model

`AuditLog` stores:

| Field | Description |
|---|---|
| `action` | `AuditAction` enum (see below) |
| `actorUserId` | Admin user id when applicable; `null` for system/cron |
| `actorRole` | Role at time of action |
| `entityType` | `AuditEntityType` — primary object type |
| `entityId` | Primary object id (or `broadcast` for mass notification) |
| `metadata` | JSON details (amount, reason, status, etc.) |
| `createdAt` | Immutable timestamp |

### `AuditAction` values

- `TRANSACTION_MARK_PAID` — admin confirms dummy payment
- `TRANSACTION_REFUND` — admin manual refund
- `TRANSACTION_SLA_AUTO_REFUND` — cron SLA auto-refund
- `REVIEW_MODERATE` — admin hide/unhide review
- `PHYSIOTHERAPIST_VERIFY` — admin approve/reject therapist
- `NOTIFICATION_BROADCAST` — admin broadcast to all users
- `NOTIFICATION_SEND_USER` — admin direct notification to one user

## API

### `GET /admin/audit-logs` (Role: `ADMIN`)

Paginated list with optional filters:

- `action`, `entityType`, `entityId`, `actorUserId`
- `from`, `to` (ISO date strings)
- `page`, `limit`

Response includes `actor` summary (`fullName`, `email`, `role`) when `actorUserId` is set.

## Wiring

`AuditService.record()` is called from:

- `BookingsService` — mark paid, refund, SLA auto-refund
- `ReviewsService` — review moderation
- `PhysiotherapistsService` — therapist verification
- `NotificationsService` — admin send/broadcast

Failures to write audit rows are logged and do not fail the business operation.

## Migration

`20260525120000_audit_log`

```bash
npx prisma migrate deploy
```

## Related policy

See [`product-policy.md`](./product-policy.md) §6 (admin actions traceability).
