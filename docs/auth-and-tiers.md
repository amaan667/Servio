### Auth, tiers, and KDS – overview

This document summarises how authentication, tiers, and KDS access work in the current architecture.

---

### 1. How does a request become authenticated?

- **Middleware (`middleware.ts`) is the single source of truth for auth.**
  - It reads Supabase cookies and calls `supabase.auth.getUser()` (with automatic refresh).
  - On success, it sets trusted headers:
    - `x-user-id`
    - `x-user-email`
  - It **strips any incoming `x-user-*` / `x-venue-id` headers** from the original request to prevent spoofing.
- **Protected paths** (e.g. `/dashboard`, `/api/kds`, `/api/tables`, `/api/inventory`, etc.) must pass through middleware.
  - Routes and pages **never** talk to Supabase auth directly; they just read the headers.
- For API routes that use `createUnifiedHandler`:
  - `getAuthUserFromRequest` in `lib/auth/unified-auth.ts` reads `x-user-id`/`x-user-email`.
  - If headers are missing, it can fall back to Supabase SSR client for non‑middleware paths (e.g. some Stripe routes).

**Key rule:** *middleware authenticates, routes trust `x-user-id` / `x-user-email`. No duplicate auth checks.*

---

### 2. Where are tiers and roles enforced?

- **Access context + tiers**
  - `lib/access/getAccessContext.ts` and `lib/tier-restrictions.ts` define the tier model (`starter`, `pro`, `enterprise`) and feature flags.
  - `verifyVenueAccess` + `getAccessContext` (in `lib/auth/unified-auth.ts`) load:
    - User
    - Venue
    - Role (e.g. `owner`, `manager`, `staff`)
    - Tier and tier limits (from `TIER_LIMITS`).
- **Feature & limit checks**
  - `checkFeatureAccessUnified` / `checkResourceLimitUnified` in `lib/auth/unified-auth.ts` and helpers in:
    - `lib/access-control.ts`
    - `lib/tier-enforcement-helper.ts`
    - `lib/navigation-helpers.ts`
  - These functions are the *only* way routes/pages should check:
    - “Can this user access feature X?” (e.g. analytics, KDS, AI assistant)
    - “Can this user create more of resource Y?” (tables, menu items, staff, venues)
- **Pages**
  - Dashboard pages use `getAuthFromMiddlewareHeaders` / `requirePageAuth` from `lib/auth/page-auth-helper.ts`.
  - `requirePageAuth` can enforce `requireRole` to restrict pages to specific roles while still trusting middleware for tier.

**Key rule:** *tier/role logic lives in `lib/auth/unified-auth.ts`, `lib/tier-restrictions.ts`, and their helpers. Pages and routes call these helpers instead of reinventing checks.*

---

### 3. How does KDS auth differ from public menu / ordering?

- **KDS (`/api/kds/*`)**
  - All KDS API routes are behind middleware and use `createUnifiedHandler` with:
    - `requireVenueAccess: true`
    - `venueIdSource: "query"` (or auto)
    - `rateLimit: RATE_LIMITS.KDS`
  - Auth flow:
    1. Middleware authenticates the user and sets `x-user-id`/`x-user-email`.
    2. `createUnifiedHandler` reads the user from headers and verifies venue access.
    3. KDS routes trust `context.venueId` and `context.user`.
  - Result: KDS is **staff‑only**, venue‑scoped, and strongly rate-limited.

- **Public menu / ordering**
  - Public endpoints (e.g. customer menu, placing an order via QR) are intentionally **not** in `protectedPaths`:
    - They do **not** require Supabase auth cookies.
    - They may still use **per‑IP** or **public** rate limiting, but not `x-user-id` based.
  - These routes do not rely on `getAuthUserFromRequest` / `verifyVenueAccess`; instead they validate inputs (e.g. `venueId` in URL) and apply business rules suitable for anonymous customers.

**Key rule:** *KDS is authenticated and venue-locked; public menu/order endpoints are anonymous but validated and rate-limited separately.*

