import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [SETUP DAILY RESET] Setting up daily reset configuration');
    
    const { venueId } = await request.json();
    console.log('🔧 [SETUP DAILY RESET] Request data:', { venueId });

    if (!venueId) {
      console.log('🔧 [SETUP DAILY RESET] Missing venueId');
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    console.log('🔧 [SETUP DAILY RESET] Admin Supabase client created');

    // Step 1: Add the daily_reset_time column if it doesn't exist
    console.log('🔧 [SETUP DAILY RESET] Step 1: Adding daily_reset_time column...');
    
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add the new column
        ALTER TABLE venues 
        ADD COLUMN IF NOT EXISTS daily_reset_time TIME DEFAULT '00:00:00';
        
        -- Add a comment to explain the column
        COMMENT ON COLUMN venues.daily_reset_time IS 'Time of day when automatic daily reset should run (24-hour format, e.g. 04:00:00 for 4 AM)';
        
        -- Update existing venues to have the default reset time
        UPDATE venues 
        SET daily_reset_time = '00:00:00' 
        WHERE daily_reset_time IS NULL;
        
        -- Make the column NOT NULL with default
        ALTER TABLE venues 
        ALTER COLUMN daily_reset_time SET NOT NULL;
        
        -- Create an index for efficient querying
        CREATE INDEX IF NOT EXISTS idx_venues_daily_reset_time ON venues(daily_reset_time);
      `
    });

    if (alterError) {
      console.error('🔧 [SETUP DAILY RESET] Error adding column:', alterError);
      // Don't fail if column already exists
      console.log('🔧 [SETUP DAILY RESET] Column might already exist, continuing...');
    } else {
      console.log('🔧 [SETUP DAILY RESET] Successfully added daily_reset_time column');
    }

    // Step 2: Check if venue exists and update its reset time
    console.log('🔧 [SETUP DAILY RESET] Step 2: Configuring venue reset time...');
    
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name, daily_reset_time')
      .eq('venue_id', venueId)
      .single();

    if (venueError) {
      console.error('🔧 [SETUP DAILY RESET] Error fetching venue:', venueError);
      return NextResponse.json(
        { error: `Database error: ${venueError.message}` },
        { status: 500 }
      );
    }

    if (!venue) {
      console.log('🔧 [SETUP DAILY RESET] Venue not found for ID:', venueId);
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    console.log('🔧 [SETUP DAILY RESET] Found venue:', venue.name);

    // Step 3: Set the venue's daily reset time to midnight (00:00:00)
    const { error: updateError } = await supabase
      .from('venues')
      .update({ 
        daily_reset_time: '00:00:00',
        updated_at: new Date().toISOString()
      })
      .eq('venue_id', venueId);

    if (updateError) {
      console.error('🔧 [SETUP DAILY RESET] Error updating venue reset time:', updateError);
      return NextResponse.json(
        { error: 'Failed to update venue reset time' },
        { status: 500 }
      );
    }

    console.log('🔧 [SETUP DAILY RESET] Successfully configured daily reset for venue:', venue.name);

    // Step 4: Verify the configuration
    const { data: updatedVenue, error: verifyError } = await supabase
      .from('venues')
      .select('venue_id, name, daily_reset_time')
      .eq('venue_id', venueId)
      .single();

    if (verifyError) {
      console.error('🔧 [SETUP DAILY RESET] Error verifying configuration:', verifyError);
    } else {
      console.log('🔧 [SETUP DAILY RESET] Verified configuration:', updatedVenue);
    }

    return NextResponse.json({
      success: true,
      message: 'Daily reset configuration completed successfully',
      venue: {
        venueId: venue.venue_id,
        venueName: venue.name,
        dailyResetTime: '00:00:00',
        nextReset: 'Tonight at midnight (00:00:00)'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔧 [SETUP DAILY RESET] Error in setup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check current configuration
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name, daily_reset_time')
      .eq('venue_id', venueId)
      .single();

    if (venueError) {
      console.error('🔧 [SETUP DAILY RESET] Error fetching venue:', venueError);
      return NextResponse.json(
        { error: `Database error: ${venueError.message}` },
        { status: 500 }
      );
    }

    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      venue: {
        venueId: venue.venue_id,
        venueName: venue.name,
        dailyResetTime: venue.daily_reset_time,
        configured: !!venue.daily_reset_time
      }
    });

  } catch (error) {
    console.error('🔧 [SETUP DAILY RESET] Error checking configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
