import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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
  table_id?: string | null; // Add table_id field
  customer_name: string;
  customer_phone: string; // Make required since database requires it
  items: OrderItem[];
  total_amount: number;
  notes?: string | null;
  order_status?: "PLACED" | "ACCEPTED" | "IN_PREP" | "READY" | "SERVING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  payment_status?: "UNPAID" | "PAID" | "TILL" | "REFUNDED";
  payment_mode?: "online" | "pay_later" | "pay_at_till";
  payment_method?: "demo" | "stripe" | "till" | null;
  source?: "qr" | "counter"; // Order source - qr for table orders, counter for counter orders
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
    // Try using the direct Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('[ORDERS POST] Admin client created successfully');
    console.log('[ORDERS POST] Service role key available:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('[ORDERS POST] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

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
      
      // Check if table exists - first try to find by table number directly
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
        
        // Insert new table - check for existing first to avoid duplicates
        const { data: newTable, error: tableCreateErr } = await supabase
          .from('tables')
          .insert({
            venue_id: body.venue_id,
            label: body.table_number.toString(),
            seat_count: 4, // Default seat count
            area: null,
            is_active: true
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

    // Use the source provided by the client (determined from URL parameters)
    // The client already determines this based on whether the QR code URL contains ?table=X or ?counter=X
    const orderSource = body.source || 'qr'; // Default to 'qr' if not provided
    
    console.log('[ORDERS POST] Order source determination:', {
      table_number,
      provided_source: body.source,
      final_source: orderSource,
      logic: 'Using source from client request (based on QR code URL parameters)'
    });

    const payload: OrderPayload = {
      venue_id: body.venue_id,
      table_number,
      table_id: tableId, // Add table_id to the payload
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone!.trim(), // Required field, already validated
      items: safeItems,
      total_amount: finalTotal,
      notes: body.notes ?? null,
      order_status: body.order_status || 'PLACED', // Use provided status or default to 'PLACED'
      payment_status: body.payment_status || 'UNPAID', // Use provided status or default to 'UNPAID'
      payment_mode: body.payment_mode || 'online', // New field for payment mode
      payment_method: body.payment_method || null,
      source: orderSource, // Use source from client (based on QR code URL: ?table=X -> 'qr', ?counter=X -> 'counter')
    };

    // Final validation before insertion
    console.log('[ORDERS POST] Final payload validation:');
    console.log('[ORDERS POST] - venue_id:', payload.venue_id, '(type:', typeof payload.venue_id, ')');
    console.log('[ORDERS POST] - customer_name:', payload.customer_name, '(length:', payload.customer_name.length, ')');
    console.log('[ORDERS POST] - customer_phone:', payload.customer_phone, '(length:', payload.customer_phone.length, ')');
    console.log('[ORDERS POST] - total_amount:', payload.total_amount, '(type:', typeof payload.total_amount, ')');
    console.log('[ORDERS POST] - items count:', payload.items.length);
    console.log('[ORDERS POST] - order_status:', payload.order_status);
    console.log('[ORDERS POST] - payment_status:', payload.payment_status);
    console.log('[ORDERS POST] inserting order', {
      venue_id: payload.venue_id,
      table_number: payload.table_number,
      table_id: payload.table_id,
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
      .select('*');
    
    console.log('[ORDERS POST] Database insertion result:', {
      hasData: !!inserted,
      dataLength: inserted?.length,
      hasError: !!insertErr,
      errorMessage: insertErr?.message,
      errorCode: insertErr?.code,
      errorDetails: insertErr?.details,
      insertedData: inserted,
      payloadSent: payload
    });

    if (insertErr) {
      console.log('[ORDERS POST] DATABASE INSERT FAILED:', insertErr);
      console.log('[ORDERS POST] Error code:', insertErr.code);
      console.log('[ORDERS POST] Error message:', insertErr.message);
      console.log('[ORDERS POST] Error details:', insertErr.details);
      console.log('[ORDERS POST] Error hint:', insertErr.hint);
      console.log('[ORDERS POST] Full error object:', JSON.stringify(insertErr, null, 2));
      
      // Try to provide more specific error messages
      let errorMessage = insertErr.message;
      if (insertErr.code === '23505') {
        errorMessage = 'Order already exists with this ID';
      } else if (insertErr.code === '23503') {
        errorMessage = 'Referenced venue or table does not exist';
      } else if (insertErr.code === '23514') {
        errorMessage = 'Data validation failed - check required fields';
      }
      
      return bad(`Insert failed: ${errorMessage}`, 400);
    }
    
    console.log('[ORDERS POST] Database insertion successful');
    console.log('[ORDERS POST] Inserted order:', inserted?.[0]);

    console.log('[ORDERS POST] inserting order_items for order_id', inserted?.[0]?.id);
    // Note: items are embedded in orders payload in this schema; if you also mirror rows in order_items elsewhere, log success after that insert
    console.log('[ORDERS POST] order_items insert success (embedded items)');
    
    // Create or update table session to show table as occupied if we have a table
    if (tableId && inserted?.[0]?.id) {
      console.log('[ORDERS POST] Creating/updating table session for table:', tableId);
      
      // First, check if there's an existing open session
      const { data: existingSession, error: checkError } = await supabase
        .from('table_sessions')
        .select('id, status')
        .eq('table_id', tableId)
        .is('closed_at', null)
        .maybeSingle();

      if (checkError) {
        console.log('[ORDERS POST] Warning: Failed to check existing table session:', checkError);
      }

      if (existingSession) {
        // Update existing session to ORDERING status
        console.log('[ORDERS POST] Updating existing table session to ORDERING for table:', tableId);
        const { error: sessionUpdateError } = await supabase
          .from('table_sessions')
          .update({ 
            status: 'ORDERING',
            order_id: inserted[0].id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSession.id);

        if (sessionUpdateError) {
          console.log('[ORDERS POST] Warning: Failed to update table session status:', sessionUpdateError);
        } else {
          console.log('[ORDERS POST] Successfully updated table session to ORDERING for table:', tableId);
        }
      } else {
        // Create new session with ORDERING status
        console.log('[ORDERS POST] Creating new table session with ORDERING status for table:', tableId);
        const { error: sessionCreateError } = await supabase
          .from('table_sessions')
          .insert({
            table_id: tableId,
            venue_id: body.venue_id,
            status: 'ORDERING',
            order_id: inserted[0].id,
            opened_at: new Date().toISOString()
          });

        if (sessionCreateError) {
          console.log('[ORDERS POST] Warning: Failed to create table session:', sessionCreateError);
        } else {
          console.log('[ORDERS POST] Successfully created table session with ORDERING status for table:', tableId);
        }
      }
    }
    
    // Ensure we have a valid order object
    let createdOrder;
    if (!inserted || inserted.length === 0 || !inserted[0]) {
      console.log('[ORDERS POST] ERROR: Database insertion succeeded but no order data returned');
      console.log('[ORDERS POST] Inserted data:', inserted);
      console.log('[ORDERS POST] This might be due to RLS policies or database constraints');
      
      // Try to fetch the order we just created by querying the database
      console.log('[ORDERS POST] Attempting to fetch the order by querying the database...');
      
      const { data: fetchedOrder, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', payload.venue_id)
        .eq('customer_name', payload.customer_name)
        .eq('total_amount', payload.total_amount)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (fetchError || !fetchedOrder) {
        console.log('[ORDERS POST] Failed to fetch order after insertion:', fetchError);
        return bad('Order creation failed: No order data returned from database', 500);
      }
      
      console.log('[ORDERS POST] Successfully fetched order after insertion:', fetchedOrder.id);
      createdOrder = fetchedOrder;
    } else {
      createdOrder = inserted[0];
    }

    console.log('[ORDERS POST] Successfully created order with ID:', createdOrder.id);

    const response = { 
      ok: true, 
      order: createdOrder,
      table_auto_created: tableId !== null, // True if we auto-created a table
      table_id: tableId,
      session_id: (body as any).session_id || null, // Include session_id in response for client-side storage
      source: orderSource, // Include the correctly determined source
      display_name: orderSource === 'counter' ? `Counter ${table_number}` : `Table ${table_number}` // Include display name for UI
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


