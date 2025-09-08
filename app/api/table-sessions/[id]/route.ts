import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { status, order_id, closed_at } = body;

    const supabase = await createClient();

    // Update table session
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (order_id !== undefined) {
      updateData.order_id = order_id;
    }

    if (closed_at !== undefined) {
      updateData.closed_at = closed_at;
    }

    const { data: session, error } = await supabase
      .from('table_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[TABLE SESSIONS API] Error updating session:', error);
      return NextResponse.json({ error: 'Failed to update table session' }, { status: 500 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('[TABLE SESSIONS API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    // Delete table session
    const { error } = await supabase
      .from('table_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[TABLE SESSIONS API] Error deleting session:', error);
      return NextResponse.json({ error: 'Failed to delete table session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TABLE SESSIONS API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
