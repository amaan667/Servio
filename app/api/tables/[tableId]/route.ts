import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    const body = await req.json();
    const { label, seat_count, is_active, qr_version } = body;

    const supabase = await createClient();

    // Update table
    const updateData: any = {
      label: label?.trim(),
      seat_count,
      is_active,
      updated_at: new Date().toISOString(),
    };

    if (qr_version !== undefined) {
      updateData.qr_version = qr_version;
    }

    const { data: table, error } = await supabase
      .from('tables')
      .update(updateData)
      .eq('id', tableId)
      .select()
      .single();

    if (error) {
      console.error('[TABLES API] Error updating table:', error);
      return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
    }

    return NextResponse.json({ table });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await context.params;
    console.log('[TABLES API] DELETE request for tableId:', tableId);

    const supabase = await createClient();

    // First check if table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('tables')
      .select('id, label, venue_id')
      .eq('id', tableId)
      .single();

    if (checkError) {
      console.error('[TABLES API] Error checking table existence:', checkError);
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    console.log('[TABLES API] Found table to delete:', existingTable);

    // Delete table (this will cascade to table_sessions)
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId);

    if (error) {
      console.error('[TABLES API] Error deleting table:', error);
      return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });
    }

    console.log('[TABLES API] Table deleted successfully:', tableId);
    return NextResponse.json({ success: true, deletedTable: existingTable });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
