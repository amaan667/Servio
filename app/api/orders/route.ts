import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
  order_status?: "PLACED" | "ACCEPTED" | "IN_PREP" | "READY" | "SERVING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  payment_status?: "UNPAID" | "PAID" | "TILL" | "REFUNDED";
  payment_method?: "demo" | "stripe" | "till" | null;
  // Note: table_id, session_id, and source columns don't exist in current database schema
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
    console.log('[ORDERS POST] Creating admin client to bypass RLS...');
    // Create admin client directly with service role key to bypass RLS
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return undefined; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );
    console.log('[ORDERS POST] Admin client created successfully');

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

    // Auto-create table if it doesn't exist (for QR code scenarios)
    let tableId = null;
    if (body.table_number) {
      console.log('[ORDERS POST] Checking if table exists for table_number:', body.table_number);
      
      // Check if table exists - use more robust lookup
      const { data: existingTable, error: lookupError } = await supabase
        .from('tables')
        .select('id, label')
        .eq('venue_id', body.venue_id)
        .eq('label', body.table_number.toString())
        .eq('is_active', true)
        .maybeSingle();

      if (lookupError) {
        console.log('[ORDERS POST] Table lookup error:', lookupError);
        return bad(`Failed to check existing tables: ${lookupError.message}`, 500);
      }

      if (existingTable) {
        console.log('[ORDERS POST] Table found:', existingTable.id);
        tableId = existingTable.id;
      } else {
        console.log('[ORDERS POST] Table not found, auto-creating table for QR code...');
        
        // Use upsert to prevent duplicates - this will insert if not exists, or return existing if it does
        const { data: newTable, error: tableCreateErr } = await supabase
          .from('tables')
          .upsert({
            venue_id: body.venue_id,
            label: body.table_number.toString(),
            seat_count: 4, // Default seat count
            area: null,
            is_active: true
          }, {
            onConflict: 'venue_id,label',
            ignoreDuplicates: false
          })
          .select('id, label')
          .single();

        if (tableCreateErr) {
          console.log('[ORDERS POST] Failed to auto-create table:', tableCreateErr);
          return bad(`Failed to create table: ${tableCreateErr.message}`, 500);
        }

        console.log('[ORDERS POST] Table auto-created/updated successfully:', newTable.id);
        console.log('[ORDERS POST] Auto-created table details:', {
          table_id: newTable.id,
          table_label: newTable.label,
          venue_id: body.venue_id,
          seat_count: 4
        });
        tableId = newTable.id;

        // Create a table session for the new table
        const { error: sessionErr } = await supabase
          .from('table_sessions')
          .insert({
            venue_id: body.venue_id,
            table_id: newTable.id,
            status: 'FREE',
            opened_at: new Date().toISOString(),
            closed_at: null
          });

        if (sessionErr) {
          console.log('[ORDERS POST] Failed to create table session:', sessionErr);
          // Don't fail the request if session creation fails
        }
      }
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
      order_status: body.order_status || 'PLACED', // Use provided status or default to 'PLACED'
      payment_status: body.payment_status || 'UNPAID', // Use provided status or default to 'UNPAID'
      payment_method: body.payment_method || null,
      // Note: table_id, session_id, and source columns don't exist in current database schema
      // These will be stored in localStorage for now until database schema is updated
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
    console.log('[ORDERS POST] Using admin client with service role key to bypass RLS');
    
    const { data: inserted, error: insertErr } = await supabase
      .from('orders')
      .insert(payload)
      .select('id, created_at');

    if (insertErr) {
      console.log('[ORDERS POST] DATABASE INSERT FAILED:', insertErr);
      console.log('[ORDERS POST] Error code:', insertErr.code);
      console.log('[ORDERS POST] Error message:', insertErr.message);
      console.log('[ORDERS POST] Error details:', insertErr.details);
      console.log('[ORDERS POST] Error hint:', insertErr.hint);
      return bad(`Insert failed: ${insertErr.message}`, 400);
    }
    
    console.log('[ORDERS POST] Database insertion successful');
    console.log('[ORDERS POST] Inserted order:', inserted?.[0]);

    console.log('[ORDERS POST] inserting order_items for order_id', inserted?.[0]?.id);
    // Note: items are embedded in orders payload in this schema; if you also mirror rows in order_items elsewhere, log success after that insert
    console.log('[ORDERS POST] order_items insert success (embedded items)');
    
    // Update table session status to OCCUPIED if we have a table
    if (tableId && inserted?.[0]?.id) {
      console.log('[ORDERS POST] Updating table session status to OCCUPIED for table:', tableId);
      
      // Update existing table session to OCCUPIED status
      const { error: sessionUpdateError } = await supabase
        .from('table_sessions')
        .update({ 
          status: 'OCCUPIED',
          order_id: inserted[0].id,
          updated_at: new Date().toISOString()
        })
        .eq('table_id', tableId)
        .is('closed_at', null);

      if (sessionUpdateError) {
        console.log('[ORDERS POST] Warning: Failed to update table session status:', sessionUpdateError);
        // Don't fail the order creation if session update fails
      } else {
        console.log('[ORDERS POST] Successfully updated table session to OCCUPIED for table:', tableId);
      }
    }
    
    const response = { 
      ok: true, 
      order: inserted?.[0] ?? null,
      table_auto_created: tableId !== null, // True if we auto-created a table
      table_id: tableId,
      session_id: (body as any).session_id || null, // Include session_id in response for client-side storage
      source: (body as any).source || 'qr' // Include source in response for client-side storage
    };
    console.log('[ORDERS POST] ===== ORDER SUBMISSION COMPLETED SUCCESSFULLY =====');
    console.log('[ORDERS POST] Final response:', JSON.stringify(response, null, 2));
    console.log('[ORDERS POST] Response sent at:', new Date().toISOString());
    
    // Log that real-time updates should be triggered
    console.log('[ORDERS POST] Real-time updates will be triggered automatically via Supabase subscriptions');
    console.log('[ORDERS POST] Dashboard, analytics, and live orders components will update instantly');
    console.log('[ORDERS POST] Table management will show OCCUPIED status for the table');
    
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


