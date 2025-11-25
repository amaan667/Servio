import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export const POST = withUnifiedAuth(
  async (req: NextRequest, _context) => {
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

    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

    const { error } = await admin.rpc('exec_sql', { sql });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
      return NextResponse.json({ ok:true });
    } catch (e:unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      return NextResponse.json({ ok:false, error: errorMessage || 'RPC exec failed' }, { status:500 });
    }
  }
);

