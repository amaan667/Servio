import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    console.log('[KDS MIGRATION] Starting KDS schema migration...');
    
    // Create KDS Stations table
    const { error: stationsError } = await supabaseAdmin.rpc('exec', {
      query: `
        CREATE TABLE IF NOT EXISTS kds_stations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
          station_name TEXT NOT NULL,
          station_type TEXT,
          display_order INTEGER DEFAULT 0,
          color_code TEXT DEFAULT '#3b82f6',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(venue_id, station_name)
        );
      `
    });
    
    if (stationsError) {
      console.warn('[KDS MIGRATION] Stations table creation warning:', stationsError.message);
    }
    
    // Create KDS Tickets table
    const { error: ticketsError } = await supabaseAdmin.rpc('exec', {
      query: `
        CREATE TABLE IF NOT EXISTS kds_tickets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
          order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          special_instructions TEXT,
          status TEXT NOT NULL DEFAULT 'new',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          started_at TIMESTAMPTZ,
          ready_at TIMESTAMPTZ,
          bumped_at TIMESTAMPTZ,
          table_number INTEGER,
          table_label TEXT,
          priority INTEGER DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (ticketsError) {
      console.warn('[KDS MIGRATION] Tickets table creation warning:', ticketsError.message);
    }
    
    // Create indexes
    await supabaseAdmin.rpc('exec', {
      query: 'CREATE INDEX IF NOT EXISTS idx_kds_tickets_venue ON kds_tickets(venue_id);'
    });
    
    await supabaseAdmin.rpc('exec', {
      query: 'CREATE INDEX IF NOT EXISTS idx_kds_tickets_order ON kds_tickets(order_id);'
    });
    
    await supabaseAdmin.rpc('exec', {
      query: 'CREATE INDEX IF NOT EXISTS idx_kds_tickets_station ON kds_tickets(station_id);'
    });
    
    await supabaseAdmin.rpc('exec', {
      query: 'CREATE INDEX IF NOT EXISTS idx_kds_tickets_status ON kds_tickets(status);'
    });
    
    // Create default stations for existing venues
    const { data: venues } = await supabaseAdmin
      .from('venues')
      .select('venue_id');
    
    if (venues && venues.length > 0) {
      for (const venue of venues) {
        // Create default stations for this venue
        const defaultStations = [
          { name: 'Expo', type: 'expo', order: 0, color: '#3b82f6' },
          { name: 'Grill', type: 'grill', order: 1, color: '#ef4444' },
          { name: 'Fryer', type: 'fryer', order: 2, color: '#f59e0b' },
          { name: 'Barista', type: 'barista', order: 3, color: '#8b5cf6' },
          { name: 'Cold Prep', type: 'cold', order: 4, color: '#06b6d4' }
        ];
        
        for (const station of defaultStations) {
          const { error: insertError } = await supabaseAdmin
            .from('kds_stations')
            .upsert({
              venue_id: venue.venue_id,
              station_name: station.name,
              station_type: station.type,
              display_order: station.order,
              color_code: station.color,
              is_active: true
            }, {
              onConflict: 'venue_id,station_name'
            });
          
          if (insertError) {
            console.warn(`[KDS MIGRATION] Station creation warning for ${venue.venue_id}:`, insertError.message);
          }
        }
      }
    }
    
    console.log('[KDS MIGRATION] Schema migration completed successfully');
    
    return NextResponse.json({ 
      ok: true, 
      message: 'KDS schema migration completed successfully',
      venues_processed: venues?.length || 0
    });
    
  } catch (error: any) {
    console.error('[KDS MIGRATION] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Migration failed' 
    }, { status: 500 });
  }
}