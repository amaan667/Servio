import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { venueId, resetTime } = await request.json();

    if (!venueId || !resetTime) {
      return NextResponse.json(
        { error: 'Venue ID and reset time are required' },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM:SS)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(resetTime)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM:SS format' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // Check if user is authenticated and owns the venue
    // Use getSession() to avoid refresh token errors
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify venue ownership
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, owner_id')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .single();

    if (venueError || !venue) {
      return NextResponse.json(
        { error: 'Venue not found or access denied' },
        { status: 404 }
      );
    }

    // Update the reset time
    const { error: updateError } = await supabase
      .from('venues')
      .update({ daily_reset_time: resetTime })
      .eq('venue_id', venueId);

    if (updateError) {
      logger.error('Error updating reset time:', updateError);
      return NextResponse.json(
        { error: 'Failed to update reset time' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reset time updated successfully',
      resetTime
    });

  } catch (error) {
    logger.error('Error in update reset time API:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
