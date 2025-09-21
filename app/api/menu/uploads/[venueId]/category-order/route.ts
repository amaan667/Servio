import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
      .select('categories')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[CATEGORY ORDER API] Error fetching upload data:', error);
      return NextResponse.json({ error: 'Failed to fetch category order' }, { status: 500 });
    }

    return NextResponse.json({
      categories: uploadData?.categories || null
    });

  } catch (error: any) {
    console.error('[CATEGORY ORDER API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
