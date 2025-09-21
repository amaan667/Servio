import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // Get some recent orders to see their actual data
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, table_number, table_id, source, customer_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      orders: orders?.map(order => ({
        id: order.id,
        table_number: order.table_number,
        table_id: order.table_id,
        source: order.source,
        customer_name: order.customer_name,
        created_at: order.created_at,
        // Show what the mapping would produce
        mapped_source: mapLegacySource(order.source),
        entity_kind: deriveEntityKind({
          table_id: order.table_id,
          source: mapLegacySource(order.source),
          table: null
        })
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function mapLegacySource(source?: string): string {
  switch (source) {
    case 'qr':
      return 'qr_table';
    case 'counter':
      return 'qr_counter';
    default:
      return 'unknown';
  }
}

function deriveEntityKind(order: {
  table_id: string | null;
  source?: string;
  table?: { is_configured: boolean } | null;
}): string {
  if (order.source === 'qr_table' || order.source === 'qr') {
    return 'table';
  }
  if (order.source === 'qr_counter' || order.source === 'counter') {
    return 'counter';
  }
  if (order.table_id) {
    return 'table';
  }
  if (order.table?.is_configured === true) {
    return 'table';
  }
  return 'counter';
}
