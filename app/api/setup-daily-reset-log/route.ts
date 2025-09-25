import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    
    const supabase = await createServerSupabase();

    // Create the daily_reset_log table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS daily_reset_log (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          venue_id TEXT NOT NULL,
          reset_date DATE NOT NULL,
          reset_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_orders INTEGER DEFAULT 0,
          canceled_reservations INTEGER DEFAULT 0,
          reset_tables INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Ensure only one reset per venue per day
          UNIQUE(venue_id, reset_date)
        );
      `
    });

    if (createTableError) {
      console.error('🔧 [SETUP] Error creating table:', createTableError);
      return NextResponse.json(
        { error: 'Failed to create daily_reset_log table' },
        { status: 500 }
      );
    }

    // Create index
    const { error: createIndexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_daily_reset_log_venue_date ON daily_reset_log(venue_id, reset_date);
      `
    });

    if (createIndexError) {
      console.error('🔧 [SETUP] Error creating index:', createIndexError);
      // Don't fail for index creation
    }

    // Enable RLS
    const { error: enableRLSError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE daily_reset_log ENABLE ROW LEVEL SECURITY;
      `
    });

    if (enableRLSError) {
      console.error('🔧 [SETUP] Error enabling RLS:', enableRLSError);
      // Don't fail for RLS
    }


    return NextResponse.json({
      success: true,
      message: 'Daily reset log table setup completed'
    });

  } catch (error) {
    console.error('🔧 [SETUP] Error setting up daily reset log:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
