# Swagger API Docs (Step 11)

Swagger/OpenAPI documentation is now integrated to help frontend and Postman workflows.

## Access URL

- Local docs: `http://localhost:3000/docs`

## What is included

- OpenAPI document generation via `@nestjs/swagger`
- JWT bearer auth support in Swagger UI (`Authorize` button)
- Module tags for easier navigation:
  - Auth
  - Users
  - Categories
  - Physiotherapists
  - Consultations & Bookings & Transactions
  - Chat
  - Reviews
  - Admin Dashboard
  - Health
- Operation summaries for each endpoint
- DTO examples for common payloads (register, login, pagination)

## Authentication in Swagger

1. Call `POST /auth/login`
2. Copy `accessToken`
3. Click **Authorize** in Swagger UI
4. Paste token as: `Bearer <accessToken>`

## Why this matters

- Speeds up frontend integration by exposing endpoint contracts in one place.
- Reduces payload mistakes with visible DTO shape and examples.
- Makes onboarding easier for new collaborators and evaluators.
