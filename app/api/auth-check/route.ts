import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('[AUTH CHECK] User error:', userError);
      return NextResponse.json({ 
        authenticated: false, 
        error: userError.message 
      });
    }
    
    if (!user) {
      console.log('[AUTH CHECK] No user found');
      return NextResponse.json({ 
        authenticated: false, 
        message: 'No user found' 
      });
    }
    
    console.log('[AUTH CHECK] User authenticated:', { userId: user.id, email: user.email });
    
    // Get user's venues
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', user.id);
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email
      },
      venues: venues || [],
      venueError: venueError?.message
    });
    
  } catch (error) {
    console.error('[AUTH CHECK] Unexpected error:', error);
    return NextResponse.json({ 
      authenticated: false, 
      error: 'Unexpected error occurred' 
    });
  }
}
