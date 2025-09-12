import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const sql = `
    -- Create the api_reserve_table RPC function
    CREATE OR REPLACE FUNCTION api_reserve_table(
      p_venue_id TEXT,
      p_table_id TEXT,
      p_start_at TIMESTAMPTZ,
      p_end_at TIMESTAMPTZ,
      p_party_size INTEGER,
      p_name TEXT DEFAULT NULL,
      p_phone TEXT DEFAULT NULL
    )
    RETURNS JSON
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      reservation_id UUID;
      result JSON;
    BEGIN
      -- Validate inputs
      IF p_venue_id IS NULL OR p_venue_id = '' THEN
        RETURN json_build_object('success', false, 'error', 'venue_id is required');
      END IF;
      
      IF p_start_at IS NULL OR p_end_at IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'start_at and end_at are required');
      END IF;
      
      IF p_start_at >= p_end_at THEN
        RETURN json_build_object('success', false, 'error', 'start_at must be before end_at');
      END IF;
      
      IF p_party_size IS NULL OR p_party_size <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'party_size must be a positive integer');
      END IF;

      -- Check if venue exists
      IF NOT EXISTS (SELECT 1 FROM venues WHERE venue_id = p_venue_id) THEN
        RETURN json_build_object('success', false, 'error', 'Venue not found');
      END IF;

      -- If table_id is provided, check if table exists
      IF p_table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tables WHERE id = p_table_id AND venue_id = p_venue_id) THEN
        RETURN json_build_object('success', false, 'error', 'Table not found');
      END IF;

      -- Check for overlapping reservations if table_id is provided
      IF p_table_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM reservations 
          WHERE table_id = p_table_id 
            AND venue_id = p_venue_id
            AND status IN ('BOOKED', 'CHECKED_IN')
            AND (
              (p_start_at < end_at AND p_end_at > start_at)
            )
        ) THEN
          RETURN json_build_object('success', false, 'error', 'Table is already reserved for this time period');
        END IF;
      END IF;

      -- Create the reservation
      INSERT INTO reservations (
        venue_id,
        table_id,
        start_at,
        end_at,
        party_size,
        customer_name,
        customer_phone,
        status,
        created_at,
        updated_at
      ) VALUES (
        p_venue_id,
        p_table_id,
        p_start_at,
        p_end_at,
        p_party_size,
        p_name,
        p_phone,
        'BOOKED',
        NOW(),
        NOW()
      ) RETURNING id INTO reservation_id;

      -- Return success response
      RETURN json_build_object(
        'success', true,
        'reservation_id', reservation_id,
        'message', 'Reservation created successfully'
      );

    EXCEPTION
      WHEN OTHERS THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Failed to create reservation: ' || SQLERRM
        );
    END;
    $$;

    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION api_reserve_table TO authenticated;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('[CREATE RESERVE TABLE FUNCTION] Error:', error);
      return NextResponse.json({ 
        ok: false, 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: 'api_reserve_table function created successfully'
    });

  } catch (error: any) {
    console.error('[CREATE RESERVE TABLE FUNCTION] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
