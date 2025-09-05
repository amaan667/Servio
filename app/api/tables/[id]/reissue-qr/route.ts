import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const supabase = await createClient();

    // Get current table to increment qr_version
    const { data: currentTable, error: fetchError } = await supabase
      .from('tables')
      .select('qr_version')
      .eq('id', id)
      .single();

    if (fetchError || !currentTable) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Increment qr_version
    const { data: table, error } = await supabase
      .from('tables')
      .update({
        qr_version: (currentTable.qr_version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[TABLES API] Error reissuing QR:', error);
      return NextResponse.json({ error: 'Failed to reissue QR' }, { status: 500 });
    }

    return NextResponse.json({ table });
  } catch (error) {
    console.error('[TABLES API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
