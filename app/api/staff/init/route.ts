import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Business logic
      const admin = createAdminClient();
      const sql = `
  create table if not exists public.staff (
    id uuid primary key default gen_random_uuid(),
    venue_id text not null references public.venues(venue_id) on delete cascade,
    name text not null,
    role text not null default 'Server',
    active boolean not null default true,
    created_at timestamptz not null default now()
  );
  alter table public.staff enable row level security;
  do $$ begin
    create policy "owner can manage staff" on public.staff
    for all using (
      exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_user_id = auth.uid())
    ) with check (
      exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_user_id = auth.uid())
    );
  exception when others then null; end $$;`;

      const { error } = await admin.rpc("exec_sql", { sql });
      if (error) {
        logger.error("[STAFF INIT] SQL execution error:", {
          error: error.message,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to initialize staff table",
          isDevelopment() ? error.message : undefined
        );
      }

      logger.info("[STAFF INIT] Staff table initialized successfully", {
        userId: context.user.id,
      });

      // STEP 3: Return success response
      return success({ ok: true });
    } catch (error) {
      logger.error("[STAFF INIT] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Failed to initialize staff table",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
