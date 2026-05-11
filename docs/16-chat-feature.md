# Chat Feature (Step 8)

This feature provides simple non-realtime chat through REST API.

## Why this matters

- Enables consultation communication without WebSocket complexity.
- Keeps strict participant access so messages stay private.
- Fits MVP scope while still production-friendly.

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
List messages in one conversation (ordered oldest to newest).

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

## Database relation involved

- `Conversation` optionally links to one `Consultation`.
- `ConversationParticipant` links conversation with many users.
- `Message` belongs to conversation and sender (`User`).
