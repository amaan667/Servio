import { createServerSupabase } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { venue_id, name, business_type, address, phone, email } = await req.json();

    if (!venue_id || !name) {
      return NextResponse.json({ error: 'venue_id and name are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('venues')
      .upsert({
        venue_id,
        name,
        business_type: business_type || 'Restaurant',
        address,
        phone,
        email,
        owner_id: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'venue_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Venue upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, venue: data });
  } catch (error) {
    console.error('Venue upsert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


