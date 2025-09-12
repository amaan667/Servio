import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST ADMIN CLIENT] Testing admin client...');
    
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('🧪 [TEST ADMIN CLIENT] SUPABASE_SERVICE_ROLE_KEY not found');
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    console.log('🧪 [TEST ADMIN CLIENT] Service role key found, creating admin client...');
    const supabase = createAdminClient();
    console.log('🧪 [TEST ADMIN CLIENT] Admin client created successfully');

    // Test basic database connection
    console.log('🧪 [TEST ADMIN CLIENT] Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .limit(5);

    if (testError) {
      console.error('🧪 [TEST ADMIN CLIENT] Database connection error:', testError);
      return NextResponse.json(
        { error: `Database error: ${testError.message}` },
        { status: 500 }
      );
    }

    console.log('🧪 [TEST ADMIN CLIENT] Database connection successful, found venues:', testData?.length || 0);

    // Test specific venue lookup
    const venueId = 'venue-1e02af4d';
    console.log(`🧪 [TEST ADMIN CLIENT] Testing venue lookup for: ${venueId}`);
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', venueId)
      .single();

    if (venueError) {
      console.error('🧪 [TEST ADMIN CLIENT] Venue lookup error:', venueError);
      return NextResponse.json(
        { 
          error: `Venue lookup error: ${venueError.message}`,
          venueId,
          allVenues: testData
        },
        { status: 500 }
      );
    }

    console.log('🧪 [TEST ADMIN CLIENT] Venue found:', venue);

    return NextResponse.json({
      success: true,
      message: 'Admin client test successful',
      venue,
      allVenues: testData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🧪 [TEST ADMIN CLIENT] Error in admin client test:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
