import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/inventory/stock/movements?venue_id=xxx&limit=50&offset=0
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const venue_id = searchParams.get('venue_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const reason = searchParams.get('reason');

    if (!venue_id) {
      return NextResponse.json(
        { error: 'venue_id is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('stock_ledgers')
      .select(`
        *,
        ingredient:ingredients(name, unit)
      `)
      .eq('venue_id', venue_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reason) {
      query = query.eq('reason', reason);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[INVENTORY API] Error fetching movements:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        limit,
        offset,
        total: count || 0,
      },
    });
  } catch (error) {
    console.error('[INVENTORY API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

