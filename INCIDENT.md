# Incident runbook

Quick reference for ops when something goes wrong.

## Health checks

- **`GET /api/health`** – Minimal liveness: returns `200` and `ok`. Use for load balancer / k8s liveness. No DB or external calls.
- **`GET /api/ready`** – Readiness: checks Supabase, Redis, Stripe. Returns 200 only if all pass. Use for readiness probes and status checks.

## Rollback

1. **Railway:** Use the deployment history in the dashboard to roll back to the previous deployment.
2. **Git:** Revert the last commit and push, then redeploy:
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```

## Disable a feature in emergency

- **No feature flags in-app.** To disable something you must:
  1. Revert or comment out the code and redeploy, or
  2. Use env vars if the feature is already gated (e.g. `NEXT_PUBLIC_FEATURE_X=false`).

## Debugging 500s

1. Check logs for the **request ID** (in response body `meta.requestId` or header `X-Request-Id`). Search logs for that ID to get the full request path.
2. Check **Sentry** (if configured) for the same request ID or stack trace.
3. Verify **Supabase** and **Stripe** status pages; auth or payment issues often cause 500s.

## Auth / "Not authenticated"

- Middleware sets `x-user-id` from cookies or `Authorization: Bearer` header. If users get "Not authenticated" while signed in:
  1. Confirm cookies are sent (`credentials: 'include'` on fetch).
  2. Confirm the route path is in `protectedPaths` in `middleware.ts` so middleware runs.

## Payments

- **Stripe webhooks:** Ensure `STRIPE_WEBHOOK_SECRET` is set and the endpoint is registered in Stripe. Failed webhooks show in Stripe Dashboard → Developers → Webhooks.
- **Reconciliation:** Use `GET /api/stripe/reconcile?limit=50` (or the reconcile job) to compare your DB with Stripe.

## Contacts

- Update this section with your team / on-call / escalation contacts.
