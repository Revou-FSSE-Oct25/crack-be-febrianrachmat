# Chat Feature (Step 8)

REST messaging for consultations, plus **Server-Sent Events (SSE)** for near-real-time delivery without WebSocket infrastructure.

## Why this matters

- Enables consultation communication with low operational cost (no paid chat vendor).
- Keeps strict participant access so messages stay private.
- SSE uses standard HTTP + JWT (`Authorization: Bearer`) from the browser.

## Endpoints

All endpoints require JWT and roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`.

### `POST /chat/conversations`
Create or get conversation by consultation.

Request:

```json
{
  "consultationId": "uuid-consultation"
}
```

Behavior:
- If conversation already exists, returns existing conversation + messages.
- If not, creates conversation and participant rows for patient + therapist.

### `GET /chat/conversations`
List conversations accessible by user.

- Patient/Therapist: only their own conversations.
- Admin: all conversations.

### `GET /chat/conversations/:conversationId/messages`
List conversation messages (paginated, ordered oldest to newest).

### `GET /chat/conversations/:conversationId/messages/stream` (SSE)
Long-lived `text/event-stream` of **new** messages only.

Query:

| Param | Description |
|--------|-------------|
| `since` | Optional ISO-8601 `createdAt` of the newest message the client already has. Server emits rows with `createdAt` **strictly after** this value. |

Events:

| Event | Payload |
|--------|---------|
| (default) | JSON message object (same shape as REST list item, including `sender`). |
| `ping` | Empty keep-alive every ~30s. |

Env (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAT_SSE_POLL_MS` | `2500` | Server poll interval (ms), clamped 1000–15000. |

JWT may be sent via `Authorization: Bearer` (recommended) or query `access_token` (for tools that cannot set headers).

Response is **not** wrapped in `{ success, data }` (`@SkipEnvelope()`).

### `POST /chat/conversations/:conversationId/messages`
Send message to conversation.

Request:

```json
{
  "content": "Halo, saya ingin tanya jadwal terapi."
}
```

## Access control rules

- User must be consultation participant (patient or therapist), except admin.
- User must be conversation participant to read/send messages, except admin.
- When admin sends a message, system auto-adds admin as conversation participant.

## Payment gating (Phase 1 pay-first)

Chat is **locked** until the consultation is paid:

- `POST /chat/conversations` and `POST /chat/conversations/:id/messages`
  return `400` (`Chat is locked. Consultation must be IN_PROGRESS (current: …)`)
  whenever the related consultation is **not** `IN_PROGRESS`.
- `GET /chat/conversations/:id/messages` and the **SSE stream** remain accessible regardless of
  status so participants keep the conversation history even after refund.
- `ADMIN` always bypasses the gate (moderation override).

How a consultation reaches `IN_PROGRESS`:

1. Patient `POST /consultations` → status `REQUESTED`.
2. Therapist `PATCH /consultations/:id/status` with `ACCEPTED`.
3. Patient `POST /transactions` with `{ consultationId, amount, paymentMethod }`
   → transaction `PENDING`.
4. Admin `PATCH /admin/transactions/:id/pay` → transaction `PAID` **and**
   consultation auto-promoted to `IN_PROGRESS`, chat unlocked.
5. Refund (`PATCH /admin/transactions/:id/refund`) auto-cancels the
   consultation, which re-locks the chat for non-admin participants.

## Frontend

- Initial history: `GET .../messages`.
- Live updates: `fetch` stream to `.../messages/stream?since=<lastCreatedAt>` (`src/lib/api/chat-sse.ts`).
- Badge **Live (SSE)** on the conversation page when the stream is connected.

## Database relation involved

- `Conversation` optionally links to one `Consultation`.
- `ConversationParticipant` links conversation with many users.
- `Message` belongs to conversation and sender (`User`).
