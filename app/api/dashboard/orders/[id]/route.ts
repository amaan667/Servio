import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Order ID is required' 
      }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid JSON payload' 
      }, { status: 400 });
    }

    const { status, payment_status } = body as { 
      status?: 'pending'|'preparing'|'served'|'paid', 
      payment_status?: 'pending'|'paid'|'failed'|'refunded' 
    };

    if (status && !['pending','preparing','served','paid'].includes(status)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid status value' 
      }, { status: 400 });
    }

    if (payment_status && !['pending','paid','failed','refunded'].includes(payment_status)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid payment status value' 
      }, { status: 400 });
    }

    const supa = admin();
    
    // Map UI status -> DB status when needed (served -> delivered)
    const dbStatus = status === 'served' ? 'delivered' : status;
    const update: Record<string, any> = {};
    
    // When client asks to set status to 'paid', treat it as payment action
    if (dbStatus === 'paid') {
      update.payment_status = 'paid';
    } else if (dbStatus) {
      update.status = dbStatus;
    }
    
    if (payment_status) {
      update.payment_status = payment_status;
    }

    const { data, error } = await supa
      .from('orders')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Supabase error updating order:', error);
      return NextResponse.json({ 
        ok: false, 
        error: `Database error: ${error.message}` 
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order: data });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/dashboard/orders/[id]:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Order ID is required' 
      }, { status: 400 });
    }

    const supa = admin();
    
    const { error } = await supa
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error deleting order:', error);
      return NextResponse.json({ 
        ok: false, 
        error: `Database error: ${error.message}` 
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/dashboard/orders/[id]:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}


