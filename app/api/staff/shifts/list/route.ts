import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
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

      const { searchParams } = new URL(req.url);
      const venue_id = context.venueId || searchParams.get('venue_id');
    const staff_id = searchParams.get('staff_id');
  if (!venue_id) return NextResponse.json({ error: 'venue_id required' }, { status: 400 });

  const { createAdminClient } = await import("@/lib/supabase");
  const supabase = createAdminClient();

  let q = supabase.from('staff_shifts')
    .select(`
      id, 
      staff_id, 
      venue_id, 
      start_time, 
      end_time, 
      area,
      staff:staff_id(name, role)
    `)
    .eq('venue_id', venue_id)
    .order('start_time', { ascending: false });
  if (staff_id) q = q.eq('staff_id', staff_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // Transform the data to flatten the nested staff object
  const transformedShifts = data?.map(shift => {
    const staff = shift.staff as unknown;
    const staffObj = Array.isArray(staff) ? staff[0] : staff;
    const staffData = staffObj && typeof staffObj === 'object' ? staffObj as Record<string, unknown> : { /* Empty */ };
    return {
      ...shift,
      staff_name: staffData.name ? String(staffData.name) : 'Unknown',
      staff_role: staffData.role ? String(staffData.role) : 'Unknown'
    };
  }) || [];
  
  return NextResponse.json({ ok: true, shifts: transformedShifts });
    } catch (_error) {
      return NextResponse.json(
        { ok: false, error: _error instanceof Error ? _error.message : "Unknown error" },
        { status: 500 }
      );
    }
  }
);

