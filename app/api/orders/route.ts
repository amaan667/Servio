import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type OrderItem = {
  menu_item_id: string | null;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string | null;
};

type OrderPayload = {
  venue_id: string;
  table_number?: number | null;
  customer_name: string;
  customer_phone: string; // Make required since database requires it
  items: OrderItem[];
  total_amount: number;
  notes?: string | null;
  order_status?: string;
  payment_status?: string;
  payment_method?: string;
  // table_id and session_id removed - not in database schema
  scheduled_for?: string | null;
  prep_lead_minutes?: number;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OrderPayload>;
    console.log('[ORDERS POST] ===== ORDER SUBMISSION API CALLED =====');
    console.log('[ORDERS POST] Request received at:', new Date().toISOString());
    console.log('[ORDERS POST] Raw request body:', JSON.stringify(body, null, 2));
    console.log('[ORDERS POST] Request headers:', {
      'user-agent': req.headers.get('user-agent'),
      'referer': req.headers.get('referer'),
      'origin': req.headers.get('origin'),
    });

    console.log('[ORDERS POST] Starting validation...');
    
    if (!body.venue_id || typeof body.venue_id !== 'string') {
      console.log('[ORDERS POST] VALIDATION FAILED: venue_id is required');
      return bad('venue_id is required');
    }
    if (!body.customer_name || !body.customer_name.trim()) {
      console.log('[ORDERS POST] VALIDATION FAILED: customer_name is required');
      return bad('customer_name is required');
    }
    if (!body.customer_phone || !body.customer_phone.trim()) {
      console.log('[ORDERS POST] VALIDATION FAILED: customer_phone is required');
      return bad('customer_phone is required');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      console.log('[ORDERS POST] VALIDATION FAILED: items must be a non-empty array');
      return bad('items must be a non-empty array');
    }
    if (typeof body.total_amount !== 'number' || isNaN(body.total_amount)) {
      console.log('[ORDERS POST] VALIDATION FAILED: total_amount must be a number');
      return bad('total_amount must be a number');
    }
    
    console.log('[ORDERS POST] Validation passed successfully');

    const tn = body.table_number;
    const table_number = tn === null || tn === undefined ? null : Number.isFinite(tn) ? tn : null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return bad('Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY', 500);
    }
    const supabase = await createClient();

    // Verify venue exists, create if it doesn't (for demo purposes)
    const { data: venue, error: venueErr } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', body.venue_id)
      .maybeSingle();

    if (venueErr) {
      console.log('[ORDERS POST] Venue verification error:', venueErr);
      return bad(`Failed to verify venue: ${venueErr.message}`, 500);
    }
    
    if (!venue) {
      console.log('[ORDERS POST] Venue not found, creating default venue for demo...');
      // Create a default venue for demo purposes
      const { data: newVenue, error: createErr } = await supabase
        .from('venues')
        .insert({
          venue_id: body.venue_id,
          name: 'Demo Restaurant',
          business_type: 'restaurant',
          owner_id: null, // No owner for demo venue
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('venue_id')
        .single();
        
      if (createErr) {
        console.log('[ORDERS POST] Failed to create demo venue:', createErr);
        return bad(`Failed to create demo venue: ${createErr.message}`, 500);
      }
      console.log('[ORDERS POST] Demo venue created successfully:', newVenue);
    }

    // Recompute total server-side for safety
    const computedTotal = body.items.reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return sum + qty * price;
    }, 0);
    const finalTotal = Math.abs(computedTotal - (body.total_amount || 0)) < 0.01 ? body.total_amount! : computedTotal;

    const safeItems = body.items.map((it) => ({
      menu_item_id: it.menu_item_id ?? null,
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0, // Use 'price' field directly
      item_name: it.item_name,
      specialInstructions: (it as any).special_instructions ?? it.specialInstructions ?? null,
    }));
    console.log('[ORDERS POST] normalized safeItems', safeItems);

    const payload: OrderPayload = {
      venue_id: body.venue_id,
      table_number,
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone!.trim(), // Required field, already validated
      items: safeItems,
      total_amount: finalTotal,
      notes: body.notes ?? null,
      order_status: body.order_status || 'open', // Use provided status or default to 'open'
      payment_status: body.payment_status || 'unpaid', // Use provided status or default to 'unpaid'
      payment_method: body.payment_method || 'online',
      // table_id and session_id removed - not in database schema
    };
    console.log('[ORDERS POST] inserting order', {
      venue_id: payload.venue_id,
      table_number: payload.table_number,
      order_status: payload.order_status,
      payment_status: payload.payment_status,
      total_amount: payload.total_amount,
      itemsCount: payload.items.length,
    });

    console.log('[ORDERS POST] Attempting database insertion...');
    console.log('[ORDERS POST] Payload for insertion:', JSON.stringify(payload, null, 2));
    
    const { data: inserted, error: insertErr } = await supabase
      .from('orders')
      .insert(payload)
      .select('id, created_at');

    if (insertErr) {
      console.log('[ORDERS POST] DATABASE INSERT FAILED:', insertErr);
      return bad(`Insert failed: ${insertErr.message}`, 400);
    }
    
    console.log('[ORDERS POST] Database insertion successful');
    console.log('[ORDERS POST] Inserted order:', inserted?.[0]);

    console.log('[ORDERS POST] inserting order_items for order_id', inserted?.[0]?.id);
    // Note: items are embedded in orders payload in this schema; if you also mirror rows in order_items elsewhere, log success after that insert
    console.log('[ORDERS POST] order_items insert success (embedded items)');
    
    const response = { ok: true, order: inserted?.[0] ?? null };
    console.log('[ORDERS POST] ===== ORDER SUBMISSION COMPLETED SUCCESSFULLY =====');
    console.log('[ORDERS POST] Final response:', JSON.stringify(response, null, 2));
    console.log('[ORDERS POST] Response sent at:', new Date().toISOString());
    
    // Log that real-time updates should be triggered
    console.log('[ORDERS POST] Real-time updates will be triggered automatically via Supabase subscriptions');
    console.log('[ORDERS POST] Dashboard, analytics, and live orders components will update instantly');
    
    return NextResponse.json(response);
  } catch (e: any) {
    const msg = e?.message || (typeof e === 'string' ? e : 'Unknown server error');
    console.log('[ORDERS POST] ===== ORDER SUBMISSION FAILED =====');
    console.log('[ORDERS POST] Error occurred at:', new Date().toISOString());
    console.log('[ORDERS POST] Error message:', msg);
    console.log('[ORDERS POST] Error stack:', e?.stack);
    console.log('[ORDERS POST] Error details:', e);
    return bad(`Server error: ${msg}`, 500);
  }
}


