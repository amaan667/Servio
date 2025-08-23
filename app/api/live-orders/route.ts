import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Helper function to retry operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[LIVE ORDERS] Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  const status = searchParams.get('status');
  console.log("[LIVE ORDERS GET] raw query params:", { venueId, status });

  if (!venueId) {
    return NextResponse.json({ 
      ok: false, 
      error: 'venueId required' 
    }, { status: 400 });
  }

  try {
    // Auth check with retry
    const supabase = createServerSupabase();
    const { data: { user }, error: authError } = await retryOperation(
      () => supabase.auth.getUser()
    );
    
    console.log("[LIVE ORDERS GET] user from cookie:", user?.id);
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    // Venue ownership check with retry
    const { data: v } = await retryOperation(
      () => supabase
        .from('venues')
        .select('venue_id, owner_id')
        .eq('venue_id', venueId)
        .eq('owner_id', user.id)
        .maybeSingle()
    );
    
    console.log("[LIVE ORDERS GET] venue ownership check result:", v);
    if (!v) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Forbidden - venue not found or access denied' 
      }, { status: 403 });
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[LIVE ORDERS GET] Missing SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ 
        ok: false, 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    // Use service role with retry
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!, 
      { 
        auth: { persistSession: false },
        global: {
          headers: {
            'X-Client-Info': 'servio-live-orders-api'
          }
        }
      }
    );

    const statuses = status === 'open' ? ['pending','preparing'] : status ? [status] : undefined;
    console.log("[LIVE ORDERS GET] filtering statuses:", statuses);

    let q = admin.from('orders')
      .select(`
        id, venue_id, table_number, customer_name, customer_phone, total_amount, status, payment_status, notes, created_at, items,
        order_items ( id, item_name, name, menu_item_name, unit_price, price, quantity, special_instructions )
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (statuses) {
      q = q.in('status', statuses as any);
    }

    const { data, error } = await retryOperation(() => q);
    console.log("[LIVE ORDERS GET] raw Supabase data:", data);
    console.log("[LIVE ORDERS GET] Supabase error:", error);

    if (error) {
      console.error("[LIVE ORDERS GET] Database error:", error);
      return NextResponse.json({ 
        ok: false, 
        error: `Database error: ${error.message}` 
      }, { status: 500 });
    }

    const hydrated = (data ?? []).map((o: any) => {
      let items = (o.order_items ?? []).map((it: any) => {
        const price = Number(it.unit_price ?? it.price ?? 0);
        const qty = Number(it.quantity ?? 0);
        const item_name = (it.item_name ?? it.name ?? it.menu_item_name ?? 'Item') as string;
        return { 
          id: it.id, 
          item_name, 
          price, 
          quantity: qty, 
          special_instructions: it.special_instructions, 
          line_total: price * qty 
        };
      });
      
      if (!items.length && Array.isArray(o.items)) {
        items = (o.items as any[]).map((it: any, idx: number) => {
          const price = Number(it.unit_price ?? it.price ?? it.unitPrice ?? 0);
          const qty = Number(it.quantity ?? it.qty ?? 0);
          const item_name = (it.item_name ?? it.name ?? it.menu_item_name ?? it.title ?? 'Item') as string;
          const special_instructions = (it.special_instructions ?? it.specialInstructions ?? null) as string | null;
          return { 
            id: it.id ?? `embedded-${idx}`, 
            item_name, 
            price, 
            quantity: qty, 
            special_instructions, 
            line_total: price * qty 
          };
        });
      }
      
      const computed_total = items.reduce((sum: number, it: any) => sum + it.line_total, 0);
      return { ...o, items, computed_total };
    });

    console.log("[LIVE ORDERS GET] hydrated orders:", hydrated);

    return NextResponse.json({ 
      ok: true, 
      orders: hydrated,
      count: hydrated.length
    });
    
  } catch (error) {
    console.error("[LIVE ORDERS GET] Unexpected error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}