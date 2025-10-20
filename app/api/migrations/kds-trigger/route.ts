import { errorToContext } from '@/lib/utils/error-to-context';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { apiLogger, logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createAdminClient();
    logger.debug('[KDS TRIGGER] Creating KDS trigger function...');
    
    // Create the trigger function to automatically create KDS tickets
    const { error: functionError } = await supabaseAdmin.rpc('exec', {
      query: `
        CREATE OR REPLACE FUNCTION create_kds_tickets_from_order()
        RETURNS TRIGGER AS $$
        DECLARE
          item JSONB;
          station_record RECORD;
          item_category TEXT;
          default_station UUID;
        BEGIN
          -- Only create tickets for new orders with PLACED status
          IF NEW.order_status != 'PLACED' THEN
            RETURN NEW;
          END IF;
          
          -- Check if KDS tables exist, if not, skip ticket creation
          BEGIN
            PERFORM 1 FROM information_schema.tables WHERE table_name = 'kds_stations' AND table_schema = 'public';
            IF NOT FOUND THEN
              RETURN NEW;
            END IF;
            
            PERFORM 1 FROM information_schema.tables WHERE table_name = 'kds_tickets' AND table_schema = 'public';
            IF NOT FOUND THEN
              RETURN NEW;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RETURN NEW;
          END;
          
          -- Main ticket creation logic wrapped in exception handling
          BEGIN
            -- Get default/expo station for this venue
            SELECT id INTO default_station
            FROM kds_stations
            WHERE venue_id = NEW.venue_id
              AND station_type = 'expo'
              AND is_active = true
            LIMIT 1;
            
            -- If no expo station exists, create a default one
            IF default_station IS NULL THEN
              INSERT INTO kds_stations (venue_id, station_name, station_type, display_order, is_active)
              VALUES (NEW.venue_id, 'Expo', 'expo', 0, true)
              RETURNING id INTO default_station;
            END IF;
            
            -- Loop through each item in the order
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
            LOOP
              -- Extract item category (if available)
              item_category := COALESCE(
                (SELECT category FROM menu_items WHERE id = (item->>'menu_item_id')::TEXT LIMIT 1),
                'General'
              );
              
              -- Find the appropriate station for this category
              SELECT s.id INTO station_record
              FROM kds_stations s
              WHERE s.venue_id = NEW.venue_id
                AND s.is_active = true
                AND (s.station_type = 'expo' OR s.station_name ILIKE '%' || item_category || '%')
              ORDER BY (CASE WHEN s.station_type = 'expo' THEN 1 ELSE 2 END)
              LIMIT 1;
              
              -- Create ticket at the determined station (or default station)
              INSERT INTO kds_tickets (
                venue_id,
                order_id,
                station_id,
                item_name,
                quantity,
                special_instructions,
                table_number,
                table_label,
                status
              ) VALUES (
                NEW.venue_id,
                NEW.id,
                COALESCE(station_record.id, default_station),
                item->>'item_name',
                (item->>'quantity')::INTEGER,
                item->>'specialInstructions',
                NEW.table_number,
                COALESCE(NEW.table_id, NEW.table_number::TEXT),
                'new'
              );
            END LOOP;
            
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'KDS ticket creation failed for order %: %', NEW.id, SQLERRM;
          END;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (functionError) {
      logger.error('[KDS TRIGGER] Function creation error:', functionError.message);
      return NextResponse.json({ 
        ok: false, 
        error: functionError.message 
      }, { status: 500 });
    }
    
    // Create the trigger
    const { error: triggerError } = await supabaseAdmin.rpc('exec', {
      query: `
        DROP TRIGGER IF EXISTS trg_create_kds_tickets ON orders;
        CREATE TRIGGER trg_create_kds_tickets
          AFTER INSERT ON orders
          FOR EACH ROW
          EXECUTE FUNCTION create_kds_tickets_from_order();
      `
    });
    
    if (triggerError) {
      logger.error('[KDS TRIGGER] Trigger creation error:', triggerError.message);
      return NextResponse.json({ 
        ok: false, 
        error: triggerError.message 
      }, { status: 500 });
    }
    
    logger.debug('[KDS TRIGGER] Trigger function and trigger created successfully');
    
    return NextResponse.json({ 
      ok: true, 
      message: 'KDS trigger function and trigger created successfully' 
    });
    
  } catch (error: unknown) {
    logger.error('[KDS TRIGGER] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Trigger creation failed' 
    }, { status: 500 });
  }
}
