import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venue_id = searchParams.get('venue_id');
  const staff_id = searchParams.get('staff_id');
  if (!venue_id) return NextResponse.json({ error: 'venue_id required' }, { status: 400 });

  const admin = createAdminClient();

  let q = admin.from('staff_shifts')
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
}

