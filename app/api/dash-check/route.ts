import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const supabase = await createClient();
    const userRes = await supabase.auth.getUser();
    const venueRes = userRes.data.user 
      ? await supabase.from('venues').select('venue_id').eq('owner_id', userRes.data.user.id)
      : null;

    return NextResponse.json({
      hasUser: !!userRes.data.user,
      hasVenues: !!(venueRes?.data && venueRes.data.length > 0),
      userError: userRes.error?.message,
      venueError: venueRes?.error?.message
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
