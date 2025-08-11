import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(all) { all.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        }
      }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        error: userErr?.message || 'No user found'
      });
    }

    // Check if user has a venue
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        hasProfile: !!venue,
        venue: venue || null
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      error: error.message
    });
  }
}
