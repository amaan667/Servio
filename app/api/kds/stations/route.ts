import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// GET - Fetch all KDS stations for a venue
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'venueId is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    
    // Verify user has access to this venue
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stations for this venue
    const { data: stations, error } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[KDS] Error fetching stations:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // If no stations exist, create default ones
    if (!stations || stations.length === 0) {
      const { error: setupError } = await supabase.rpc('setup_default_kds_stations', {
        p_venue_id: venueId
      });

      if (setupError) {
        console.error('[KDS] Error setting up default stations:', setupError);
      }

      // Fetch again after setup
      const { data: newStations } = await supabase
        .from('kds_stations')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      return NextResponse.json({
        ok: true,
        stations: newStations || []
      });
    }

    return NextResponse.json({
      ok: true,
      stations
    });
  } catch (error: any) {
    console.error('[KDS] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new KDS station
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venueId, stationName, stationType, displayOrder, colorCode } = body;

    if (!venueId || !stationName) {
      return NextResponse.json(
        { ok: false, error: 'venueId and stationName are required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    
    // Verify user has access to this venue
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: station, error } = await supabase
      .from('kds_stations')
      .insert({
        venue_id: venueId,
        station_name: stationName,
        station_type: stationType || 'general',
        display_order: displayOrder || 0,
        color_code: colorCode || '#3b82f6',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('[KDS] Error creating station:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      station
    });
  } catch (error: any) {
    console.error('[KDS] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

