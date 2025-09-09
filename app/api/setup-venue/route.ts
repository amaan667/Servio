import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/setup-venue - Set up the proper venue and table structure
export async function POST(req: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const supabase = await createClient();

    // Check if user already has a venue
    const { data: existingVenue } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', user.id)
      .maybeSingle();

    let venueId: string;
    let venueName = 'Cafe Nur';

    if (existingVenue) {
      venueId = existingVenue.venue_id;
      console.log('[SETUP VENUE] Using existing venue:', venueId, existingVenue.name);
    } else {
      // Create the venue
      venueId = `venue-${Date.now()}`;
      const { data: newVenue, error: venueError } = await supabase
        .from('venues')
        .insert({
          venue_id: venueId,
          name: venueName,
          business_type: 'restaurant',
          owner_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('venue_id, name')
        .single();

      if (venueError) {
        console.error('[SETUP VENUE] Error creating venue:', venueError);
        return NextResponse.json({ ok: false, error: venueError.message }, { status: 500 });
      }

      console.log('[SETUP VENUE] Created new venue:', newVenue);
    }

    // Check if Table 1 exists
    const { data: existingTable } = await supabase
      .from('tables')
      .select('id, label')
      .eq('venue_id', venueId)
      .eq('label', 'Table 1')
      .maybeSingle();

    if (!existingTable) {
      // Create Table 1
      const { data: newTable, error: tableError } = await supabase
        .from('tables')
        .insert({
          venue_id: venueId,
          label: 'Table 1',
          seat_count: 4,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select('id, label')
        .single();

      if (tableError) {
        console.error('[SETUP VENUE] Error creating table:', tableError);
        return NextResponse.json({ ok: false, error: tableError.message }, { status: 500 });
      }

      console.log('[SETUP VENUE] Created Table 1:', newTable);

      // Create a session for Table 1
      const { error: sessionError } = await supabase
        .from('table_sessions')
        .insert({
          venue_id: venueId,
          table_id: newTable.id,
          status: 'FREE',
          opened_at: new Date().toISOString(),
          closed_at: null
        });

      if (sessionError) {
        console.error('[SETUP VENUE] Error creating table session:', sessionError);
        // Don't fail the whole operation for this
      } else {
        console.log('[SETUP VENUE] Created table session for Table 1');
      }
    } else {
      console.log('[SETUP VENUE] Table 1 already exists:', existingTable);
    }

    return NextResponse.json({
      ok: true,
      venue: {
        venue_id: venueId,
        name: venueName
      },
      message: 'Venue and table setup completed successfully'
    });

  } catch (error) {
    console.error('[SETUP VENUE] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
