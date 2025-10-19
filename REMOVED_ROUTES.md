# Removed Routes

This file documents routes that were removed during the 10/10 upgrade.

## Debug Routes (Removed)
- `app/api/debug/categories/route.ts`
- `app/api/debug/check-organization/route.ts`
- `app/api/debug/database-status/route.ts`
- `app/api/debug/fix-subscription/route.ts`
- `app/api/debug/orders/route.ts`
- `app/api/debug/stripe-config/route.ts`
- `app/api/debug/subscription-status/route.ts`
- `app/api/debug/translate-categories/route.ts`

## Test Routes (Removed)
- `app/api/test-db/route.ts`
- `app/api/test-ai-chat/route.ts`
- `app/api/test-email/route.ts`
- `app/api/test/subscription-update/route.ts`
- `app/api/test/update-plan/route.ts`

## Migration Routes (Removed)
- `app/api/migrate-ai-conversations/route.ts`
- `app/api/migrate-chat/route.ts`
- `app/api/migrate-database-constraint/route.ts`
- `app/api/migrate-staff-invitations/route.ts`

## Debug Email Route (Removed)
- `app/api/debug-email/route.ts`

**Note:** All debug, test, and migration routes have been removed from production. They can be restored from git history if needed for development.

