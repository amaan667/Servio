import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orderId, status } = await req.json();
    
    if (!orderId || !status) {
      return NextResponse.json({ ok: false, error: 'orderId and status required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select();

    if (error) {
      console.error('[UPDATE STATUS] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, order: data?.[0] });
  } catch (error) {
    console.error('[UPDATE STATUS] Unexpected error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}


