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
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  scheduled_for?: string | null;
  prep_lead_minutes?: number;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OrderPayload>;

    
    if (!body.venue_id || typeof body.venue_id !== 'string') {
      return bad('venue_id is required');
    }
    if (!body.customer_name || !body.customer_name.trim()) {
      return bad('customer_name is required');
    }
    if (!body.customer_phone || !body.customer_phone.trim()) {
      return bad('customer_phone is required');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return bad('items must be a non-empty array');
    }
    if (typeof body.total_amount !== 'number' || isNaN(body.total_amount)) {
      return bad('total_amount must be a number');
    }
    

    const tn = body.table_number;
    const table_number = tn === null || tn === undefined ? null : Number.isFinite(tn) ? tn : null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return bad('Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY', 500);
    }
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

    // Verify venue exists, create if it doesn't (for demo purposes)
    const { data: venue, error: venueErr } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', body.venue_id)
      .maybeSingle();

    if (venueErr) {
      return bad(`Failed to verify venue: ${venueErr.message}`, 500);
    }
    
    if (!venue) {
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
        return bad(`Failed to create demo venue: ${createErr.message}`, 500);
      }
    }

    // Auto-create table if it doesn't exist (for QR code scenarios)
    let tableId = null;
    if (body.table_number) {
      
      // Check if table exists - first try to find by table number directly
      const { data: existingTable, error: lookupError } = await supabase
        .from('tables')
        .select('id, label')
        .eq('venue_id', body.venue_id)
        .eq('label', body.table_number.toString())
        .eq('is_active', true)
        .maybeSingle();

      if (lookupError) {
        return bad(`Failed to check existing tables: ${lookupError.message}`, 500);
      }

      if (existingTable) {
        tableId = existingTable.id;
      } else {
        
        // Get group size from group session to determine seat count
        let seatCount = 4; // Default fallback
        try {
          const { data: groupSession } = await supabase
            .from('table_group_sessions')
            .select('total_group_size')
            .eq('venue_id', body.venue_id)
            .eq('table_number', body.table_number)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (groupSession && groupSession.total_group_size) {
            seatCount = groupSession.total_group_size;
          } else {
          }
        } catch (groupError) {
        }
        
        // Use UPSERT to prevent duplicate table creation
        const { data: newTable, error: tableCreateErr } = await supabase
          .from('tables')
          .upsert({
            venue_id: body.venue_id,
            label: body.table_number.toString(),
            seat_count: seatCount, // Use group size or default
            area: null,
            is_active: true
          }, {
            onConflict: 'venue_id,label',
            ignoreDuplicates: false
          })
          .select('id, label')
          .single();

        if (tableCreateErr) {
          // If it's a duplicate key error, try to fetch the existing table
          if (tableCreateErr.code === '23505') {
            const { data: existingTableAfterError } = await supabase
              .from('tables')
              .select('id, label')
              .eq('venue_id', body.venue_id)
              .eq('label', body.table_number.toString())
              .eq('is_active', true)
              .single();
            
            if (existingTableAfterError) {
              tableId = existingTableAfterError.id;
            } else {
              return bad(`Failed to create table: ${tableCreateErr.message}`, 500);
            }
          } else {
            return bad(`Failed to create table: ${tableCreateErr.message}`, 500);
          }
        } else {
          tableId = newTable.id;
        }

        // Only create session if we have a valid tableId
        if (tableId) {
          // Check if session already exists to prevent duplicates
          const { data: existingSession } = await supabase
            .from('table_sessions')
            .select('id')
            .eq('venue_id', body.venue_id)
            .eq('table_id', tableId)
            .is('closed_at', null)
            .maybeSingle();

          if (!existingSession) {
            const { error: sessionErr } = await supabase
              .from('table_sessions')
              .insert({
                venue_id: body.venue_id,
                table_id: tableId,
                status: 'FREE',
                opened_at: new Date().toISOString(),
                closed_at: null
              });

            if (sessionErr) {
              // Don't fail the request if session creation fails
            }
          }
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

    // Use the source provided by the client (determined from URL parameters)
    // The client already determines this based on whether the QR code URL contains ?table=X or ?counter=X
    const orderSource = body.source || 'qr'; // Default to 'qr' if not provided
    

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

    
    const { data: inserted, error: insertErr } = await supabase
      .from('orders')
      .insert(payload)
      .select('*');
    

    if (insertErr) {
      
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
    

    // Note: items are embedded in orders payload in this schema; if you also mirror rows in order_items elsewhere, log success after that insert
    
    // Create or update table session to show table as occupied if we have a table
    if (tableId && inserted?.[0]?.id) {
      
      // First, check if there's an existing open session
      const { data: existingSession, error: checkError } = await supabase
        .from('table_sessions')
        .select('id, status')
        .eq('table_id', tableId)
        .is('closed_at', null)
        .maybeSingle();

      if (checkError) {
      }

      if (existingSession) {
        // Update existing session to ORDERING status
        const { error: sessionUpdateError } = await supabase
          .from('table_sessions')
          .update({ 
            status: 'ORDERING',
            order_id: inserted[0].id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSession.id);

        if (sessionUpdateError) {
        } else {
        }
      } else {
        // Create new session with ORDERING status
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
        } else {
        }
      }
    }
    
    // Ensure we have a valid order object
    let createdOrder;
    if (!inserted || inserted.length === 0 || !inserted[0]) {
      
      // Try to fetch the order we just created by querying the database
      
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
        return bad('Order creation failed: No order data returned from database', 500);
      }
      
      createdOrder = fetchedOrder;
    } else {
      createdOrder = inserted[0];
    }


    const response = { 
      ok: true, 
      order: createdOrder,
      table_auto_created: tableId !== null, // True if we auto-created a table
      table_id: tableId,
      session_id: (body as any).session_id || null, // Include session_id in response for client-side storage
      source: orderSource, // Include the correctly determined source
      display_name: orderSource === 'counter' ? `Counter ${table_number}` : `Table ${table_number}` // Include display name for UI
    };
    
    // Log that real-time updates should be triggered
    
    return NextResponse.json(response);
  } catch (e: any) {
    const msg = e?.message || (typeof e === 'string' ? e : 'Unknown server error');
    return bad(`Server error: ${msg}`, 500);
  }
}


