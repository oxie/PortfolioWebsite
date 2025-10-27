# Manual Functionality Verification

Date: 2025-10-27

## Static Routes
- `/` marketing homepage returns HTTP 200.
- `/onboarding.html` onboarding wizard loads (HTTP 200).
- `/dashboard.html` admin workspace loads (HTTP 200).
- `/site.html` personal site preview loads (HTTP 200).

## API Endpoints
- `GET /api/profile` returns persisted profile metadata.
- `POST /api/profile` updates profile fields and returns the saved payload.
- `GET /api/categories` enumerates seeded categories with item counts.
- `POST /api/categories` creates a category; `PUT` and `DELETE` verified for updates and removal.
- `GET /api/entries` retrieves entry collection; `POST`, `PUT`, and `DELETE` exercised for CRUD operations.
- `GET /api/homepage` exposes hero, featured slots, and highlights; `PUT` updates them.
- `GET /api/messages` lists contact submissions; `POST`, `PUT`, and `DELETE` validated for inbox flow.
- `POST /api/onboarding` accepts CV text plus preferences and seeds profile, categories, entries, and homepage layout.
- `GET /api/site` aggregates the profile, categories, entries, and homepage data for the live preview.

## Notes
- State mutations during testing were rolled back to the original fixture after verification.
- All requests executed against the zero-dependency Node server started via `npm start`.
