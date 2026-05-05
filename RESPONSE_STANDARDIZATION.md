# API Response Standardization (Step 14)

This step standardizes **successful** HTTP JSON responses for predictable frontend integration.

## Success envelope

Every successful response is wrapped as:

```json
{
  "success": true,
  "data": { }
}
```

If the service returned a **paginated** object with this shape:

- `items`
- `page`
- `limit`
- `total`
- `totalPages`

the interceptor normalizes it to:

```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

## Error envelope

Errors continue to use the global exception filter format:

```json
{
  "success": false,
  "timestamp": "2026-04-11T00:00:00.000Z",
  "path": "/bookings",
  "error": {
    "code": 400,
    "message": "…",
    "details": { }
  }
}
```

## Why this matters

- Frontend can always read `response.data` for the payload.
- List endpoints get stable `meta` for tables and pagination UI.
- Errors and success are visually and structurally distinct.

## Implementation

- `src/common/interceptors/transform-response.interceptor.ts` (global)
- Registered in `src/main.ts` after the global exception filter
