import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    console.log('[DEBUG-ORDERS] Testing orders table for venueId:', venueId);
    
    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId parameter is required' 
      }, { status: 400 });
    }

    // Auth check
    const supabase = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[DEBUG-ORDERS] Auth error:', authError);
      return NextResponse.json({ 
        ok: false, 
        error: `Authentication error: ${authError.message}` 
      }, { status: 401 });
    }
    
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    console.log('[DEBUG-ORDERS] User authenticated:', user.id);

    // Test basic orders query
    console.log('[DEBUG-ORDERS] Testing basic orders query...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, venue_id, customer_name, status, created_at, items')
      .eq('venue_id', venueId)
      .limit(5);

    if (ordersError) {
      console.error('[DEBUG-ORDERS] Orders query error:', ordersError);
      return NextResponse.json({ 
        ok: false, 
        error: `Orders query failed: ${ordersError.message}`,
        details: {
          code: ordersError.code,
          details: ordersError.details,
          hint: ordersError.hint
        }
      }, { status: 500 });
    }

    console.log('[DEBUG-ORDERS] Orders query successful, found:', orders?.length || 0, 'orders');

    // Test venue ownership
    console.log('[DEBUG-ORDERS] Testing venue ownership...');
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name, owner_id')
      .eq('venue_id', venueId)
      .maybeSingle();

    if (venueError) {
      console.error('[DEBUG-ORDERS] Venue query error:', venueError);
      return NextResponse.json({ 
        ok: false, 
        error: `Venue query failed: ${venueError.message}`,
        details: {
          code: venueError.code,
          details: venueError.details,
          hint: venueError.hint
        }
      }, { status: 500 });
    }

    if (!venue) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Venue not found' 
      }, { status: 404 });
    }

    console.log('[DEBUG-ORDERS] Venue found:', venue.name);

    // Check ownership
    if (venue.owner_id !== user.id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'You do not have permission to view orders for this venue' 
      }, { status: 403 });
    }

    // Test with date filtering
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const window = {
      startUtcISO: startOfDay.toISOString(),
      endUtcISO: endOfDay.toISOString(),
    };

    console.log('[DEBUG-ORDERS] Testing date-filtered query...');
    const { data: todayOrders, error: todayError } = await supabase
      .from('orders')
      .select('id, venue_id, customer_name, status, created_at, items')
      .eq('venue_id', venueId)
      .gte('created_at', window.startUtcISO)
      .lt('created_at', window.endUtcISO)
      .order('created_at', { ascending: false });

    if (todayError) {
      console.error('[DEBUG-ORDERS] Today orders query error:', todayError);
      return NextResponse.json({ 
        ok: false, 
        error: `Today orders query failed: ${todayError.message}`,
        details: {
          code: todayError.code,
          details: todayError.details,
          hint: todayError.hint
        }
      }, { status: 500 });
    }

    console.log('[DEBUG-ORDERS] Today orders query successful, found:', todayOrders?.length || 0, 'orders');

    return NextResponse.json({
      ok: true,
      venue: {
        id: venue.venue_id,
        name: venue.name,
        owner_id: venue.owner_id
      },
      orders: {
        total: orders?.length || 0,
        today: todayOrders?.length || 0,
        sample: orders?.slice(0, 3) || []
      },
      dateWindow: window,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('[DEBUG-ORDERS] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}