# Category Feature (Step 6)

This feature adds category management for therapist specialization.

## Why this matters

- Categories make therapist browsing structured and filterable.
- Admin controls category quality and consistency.
- Therapist profile module depends on valid category references.

## Endpoints

All endpoints require JWT.

### `GET /categories` (Roles: `ADMIN`, `PATIENT`, `PHYSIOTHERAPIST`)

Get all categories for dropdown/filter usage.

Response example:

```json
[
  {
    "id": "uuid",
    "name": "Sports Injury",
    "description": "Rehabilitation for sport-related injuries",
    "createdAt": "2026-04-10T10:00:00.000Z",
    "updatedAt": "2026-04-10T10:00:00.000Z"
  }
]
```

### `POST /admin/categories` (Role: `ADMIN`)

Create new category.

Request:

```json
{
  "name": "Post Surgery Rehab",
  "description": "Recovery physiotherapy after surgery"
}
```

### `PATCH /admin/categories/:categoryId` (Role: `ADMIN`)

Update category name/description.

### `DELETE /admin/categories/:categoryId` (Role: `ADMIN`)

Delete category only if not used by therapist profiles.

Response:

```json
{
  "message": "Category deleted successfully."
}
```

## Validation and business rules

- Category name is unique.
- Name minimum length: 3.
- Cannot delete category that is still assigned to physiotherapists.

## Database relation

- `Category` has one-to-many relation to `PhysiotherapistProfile`.
