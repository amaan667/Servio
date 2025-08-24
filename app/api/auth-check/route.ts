import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRoute } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseForRoute(new NextResponse());
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[AUTH_CHECK] Session error:', sessionError);
      
      // If it's a refresh token error, clear the session
      if (sessionError.message.includes('Invalid Refresh Token') || 
          sessionError.message.includes('Refresh Token Not Found')) {
        console.log('[AUTH_CHECK] Clearing invalid session due to refresh token error');
        await supabase.auth.signOut();
        return NextResponse.json({ 
          authenticated: false, 
          error: 'Invalid session, please sign in again',
          shouldRedirect: true 
        });
      }
      
      return NextResponse.json({ 
        authenticated: false, 
        error: sessionError.message 
      });
    }

    if (!session) {
      return NextResponse.json({ 
        authenticated: false, 
        error: 'No session found' 
      });
    }

    // Verify the user still exists and is valid
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('[AUTH_CHECK] User validation failed:', userError);
      await supabase.auth.signOut();
      return NextResponse.json({ 
        authenticated: false, 
        error: 'User validation failed',
        shouldRedirect: true 
      });
    }

    // Check if user has a venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        hasVenue: !!venue,
        venueId: venue?.venue_id,
        venueName: venue?.name
      }
    });

  } catch (error) {
    console.error('[AUTH_CHECK] Unexpected error:', error);
    return NextResponse.json({ 
      authenticated: false, 
      error: 'Authentication check failed' 
    }, { status: 500 });
  }
}
