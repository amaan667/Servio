import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );

    console.log('[DEBUG VENUE TABLES] Fetching data for venue:', venueId);

    // 1. Check user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[DEBUG VENUE TABLES] User:', user?.id, user?.email);
    console.log('[DEBUG VENUE TABLES] User error:', userError);

    // 2. Check venue ownership
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name, owner_id')
      .eq('venue_id', venueId)
      .maybeSingle();
    
    console.log('[DEBUG VENUE TABLES] Venue:', venue);
    console.log('[DEBUG VENUE TABLES] Venue error:', venueError);

    // 3. Check all venues for this user
    const { data: allVenues, error: allVenuesError } = await supabase
      .from('venues')
      .select('venue_id, name, owner_id')
      .eq('owner_id', user?.id);
    
    console.log('[DEBUG VENUE TABLES] All venues for user:', allVenues);
    console.log('[DEBUG VENUE TABLES] All venues error:', allVenuesError);

    // 4. Check tables with service role (bypasses RLS)
    const { data: tablesService, error: tablesServiceError } = await supabase
      .from('tables')
      .select('*')
      .eq('venue_id', venueId);
    
    console.log('[DEBUG VENUE TABLES] Tables with service role:', tablesService);
    console.log('[DEBUG VENUE TABLES] Tables service error:', tablesServiceError);

    // 5. Check tables with user context (respects RLS)
    const { data: tablesUser, error: tablesUserError } = await supabase
      .from('tables')
      .select('*')
      .eq('venue_id', venueId);
    
    console.log('[DEBUG VENUE TABLES] Tables with user context:', tablesUser);
    console.log('[DEBUG VENUE TABLES] Tables user error:', tablesUserError);

    return NextResponse.json({
      venueId,
      user: {
        id: user?.id,
        email: user?.email,
        error: userError?.message
      },
      venue: {
        data: venue,
        error: venueError?.message
      },
      allVenues: {
        data: allVenues,
        error: allVenuesError?.message
      },
      tablesService: {
        data: tablesService,
        count: tablesService?.length || 0,
        error: tablesServiceError?.message
      },
      tablesUser: {
        data: tablesUser,
        count: tablesUser?.length || 0,
        error: tablesUserError?.message
      }
    });

  } catch (error: any) {
    console.error('[DEBUG VENUE TABLES] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
