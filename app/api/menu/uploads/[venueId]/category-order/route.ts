import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId } = await params;
    
    if (!venueId) {
      return NextResponse.json({ error: 'Venue ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the most recent menu upload to get category order
    const { data: uploadData, error } = await supabase
      .from('menu_uploads')
      .select('parsed_json')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('[CATEGORY ORDER API] Error fetching upload data:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ error: 'Failed to fetch category order' }, { status: 500 });
    }

    // Extract categories from the parsed_json
    let categories = null;
    if (uploadData?.parsed_json && uploadData.parsed_json.categories) {
      // Categories are stored as an array of strings in the correct PDF order
      categories = uploadData.parsed_json.categories;
    } else {
    }

    return NextResponse.json({
      categories: categories || null
    });

  } catch (error: any) {
    logger.error('[CATEGORY ORDER API] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
