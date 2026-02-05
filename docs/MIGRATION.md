# API Migration Guide

This document describes how to migrate between API versions (v1 → v2) and use versioned endpoints.

## Versioned URLs

- **v1 (current):** Use `/api/v1/...` or `/api/...`. Both hit the same handlers; `/api/v1/` is the recommended prefix for new integrations.
- **v2 (future):** When we introduce breaking changes, we will add `/api/v2/...` and document differences here.

## Using v1

1. **Preferred:** Call `https://your-domain.com/api/v1/orders`, `https://your-domain.com/api/v1/catalog/replace`, etc. The server rewrites these to `/api/orders`, `/api/catalog/replace` and sets `X-API-Version: v1` on the request.
2. **Legacy:** Calling `/api/orders` (no version prefix) is still supported and is treated as v1.
3. **Response headers:** Successful responses include `X-API-Version: v1`. If we deprecate a version, responses may include `X-API-Deprecated: true` and `X-API-Sunset-Date`.

## v1 → v2 (when available)

When v2 is released:

1. **Timeline:** We will announce a deprecation period for v1 (e.g. 6 months) and a sunset date.
2. **Headers:** v1 responses will include `X-API-Deprecated: true` and a link to this migration guide.
3. **Breaking changes:** Documented in `docs/API-CHANGELOG.md` (or similar) with before/after examples.
4. **Migration steps:** Update base URL from `/api/v1/` to `/api/v2/`, then apply any request/response field renames or removals per the changelog.

## Version negotiation (optional)

Clients can also request a version via:

- **Header:** `X-API-Version: v1`
- **Accept:** `Accept: application/vnd.servio.v1+json`

The URL path `/api/v1/...` remains the primary and recommended way to use a specific version.
