import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export const POST = createUnifiedHandler(
  async (_req: NextRequest) => {
    // Business logic
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
      return apiErrors.database("Failed to initialize staff table");
    }

    return success({ ok: true });
  },
  {
    requireAuth: true,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
