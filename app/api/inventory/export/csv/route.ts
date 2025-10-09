import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/inventory/export/csv?venue_id=xxx
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const venue_id = searchParams.get('venue_id');

    if (!venue_id) {
      return NextResponse.json(
        { error: 'venue_id is required' },
        { status: 400 }
      );
    }

    // Fetch all ingredients with stock levels
    const { data, error } = await supabase
      .from('v_stock_levels')
      .select('*')
      .eq('venue_id', venue_id)
      .order('name', { ascending: true });

    if (error) {
      console.error('[INVENTORY API] Error fetching ingredients for export:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Generate CSV
    const headers = [
      'Name',
      'SKU',
      'Unit',
      'Cost Per Unit',
      'On Hand',
      'Par Level',
      'Reorder Level',
      'Supplier',
    ];

    const csvRows = [
      headers.join(','),
      ...(data || []).map((item) =>
        [
          `"${item.name || ''}"`,
          `"${item.sku || ''}"`,
          item.unit || '',
          item.cost_per_unit || 0,
          item.on_hand || 0,
          item.par_level || 0,
          item.reorder_level || 0,
          `"${item.supplier || ''}"`,
        ].join(',')
      ),
    ];

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-${venue_id}-${new Date().toISOString().split('T')[0]}.csv"`,
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

