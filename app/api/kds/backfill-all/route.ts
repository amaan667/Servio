import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    console.log('[KDS BACKFILL ALL] Starting comprehensive KDS backfill...');
    
    const { venueId } = await req.json();
    
    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    let totalOrdersProcessed = 0;
    let totalTicketsCreated = 0;
    const results = [];

    // Process different scopes
    const scopes = ['live', 'today'];
    
    for (const scope of scopes) {
      console.log(`[KDS BACKFILL ALL] Processing ${scope} scope...`);
      
      // First, ensure KDS stations exist for this venue
      const { data: existingStations } = await supabaseAdmin
        .from('kds_stations')
        .select('id, station_type')
        .eq('venue_id', venueId)
        .eq('is_active', true);

      if (!existingStations || existingStations.length === 0) {
        console.log('[KDS BACKFILL ALL] No stations found, creating default stations for venue:', venueId);
        
        // Create default stations
        const defaultStations = [
          { name: 'Expo', type: 'expo', order: 0, color: '#3b82f6' },
          { name: 'Grill', type: 'grill', order: 1, color: '#ef4444' },
          { name: 'Fryer', type: 'fryer', order: 2, color: '#f59e0b' },
          { name: 'Barista', type: 'barista', order: 3, color: '#8b5cf6' },
          { name: 'Cold Prep', type: 'cold', order: 4, color: '#06b6d4' }
        ];
        
        for (const station of defaultStations) {
          await supabaseAdmin
            .from('kds_stations')
            .upsert({
              venue_id: venueId,
              station_name: station.name,
              station_type: station.type,
              display_order: station.order,
              color_code: station.color,
              is_active: true
            }, {
              onConflict: 'venue_id,station_name'
            });
        }
        
        // Fetch stations again
        const { data: stations } = await supabaseAdmin
          .from('kds_stations')
          .select('id, station_type')
          .eq('venue_id', venueId)
          .eq('is_active', true);
        
        if (!stations || stations.length === 0) {
          throw new Error('Failed to create KDS stations');
        }
        
        if (existingStations) {
          existingStations.push(...stations);
        }
      }

      // Get the expo station (default for all items)
      if (!existingStations || existingStations.length === 0) {
        throw new Error('No KDS stations available');
      }
      
      const expoStation = existingStations.find((s: any) => s.station_type === 'expo') || existingStations[0];
      
      if (!expoStation) {
        throw new Error('No KDS station available');
      }

      // Build query for orders based on scope
      let query = supabaseAdmin
        .from('orders')
        .select('id, venue_id, table_number, table_id, items, order_status, payment_status, created_at')
        .eq('venue_id', venueId)
        .in('payment_status', ['PAID', 'UNPAID']) // Only active orders
        .in('order_status', ['PLACED', 'IN_PREP', 'READY']) // Only orders that need preparation
        .order('created_at', { ascending: false });

      // Apply time filtering based on scope
      if (scope === 'live') {
        // Live orders: last 30 minutes only
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        query = query.gte('created_at', thirtyMinutesAgo.toISOString());
      } else if (scope === 'today') {
        // Today's orders: from start of today until now
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        query = query.gte('created_at', todayStart.toISOString());
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        console.error(`[KDS BACKFILL ALL] Error fetching orders for ${scope}:`, ordersError);
        results.push({ scope, error: ordersError.message });
        continue;
      }

      if (!orders || orders.length === 0) {
        results.push({ scope, orders_processed: 0, tickets_created: 0 });
        continue;
      }

      console.log(`[KDS BACKFILL ALL] Found ${orders.length} orders for ${scope} scope`);

      let scopeOrdersProcessed = 0;
      let scopeTicketsCreated = 0;
      const scopeErrors: string[] = [];

      // Process each order
      for (const order of orders) {
        try {
          // Check if this order already has KDS tickets
          const { data: existingTickets } = await supabaseAdmin
            .from('kds_tickets')
            .select('id')
            .eq('order_id', order.id)
            .limit(1);

          if (existingTickets && existingTickets.length > 0) {
            console.log(`[KDS BACKFILL ALL] Order ${order.id} already has KDS tickets, skipping`);
            continue;
          }

          // Create tickets for each order item
          const items = Array.isArray(order.items) ? order.items : [];
          
          for (const item of items) {
            const ticketData = {
              venue_id: order.venue_id,
              order_id: order.id,
              station_id: expoStation.id,
              item_name: item.item_name || 'Unknown Item',
              quantity: parseInt(item.quantity) || 1,
              special_instructions: item.specialInstructions || null,
              table_number: order.table_number,
              table_label: order.table_id || order.table_number?.toString() || 'Unknown',
              status: 'new'
            };
            
            const { error: ticketError } = await supabaseAdmin
              .from('kds_tickets')
              .insert(ticketData);
            
            if (ticketError) {
              console.error('[KDS BACKFILL ALL] Failed to create ticket for item:', item, ticketError);
              scopeErrors.push(`Failed to create ticket for order ${order.id}: ${ticketError.message}`);
              continue;
            }
            
            scopeTicketsCreated++;
          }
          
          scopeOrdersProcessed++;
          console.log(`[KDS BACKFILL ALL] Processed order ${order.id} with ${items.length} items for ${scope}`);
          
        } catch (error: any) {
          console.error(`[KDS BACKFILL ALL] Error processing order ${order.id} for ${scope}:`, error);
          scopeErrors.push(`Error processing order ${order.id}: ${error.message}`);
        }
      }

      totalOrdersProcessed += scopeOrdersProcessed;
      totalTicketsCreated += scopeTicketsCreated;

      results.push({
        scope,
        orders_processed: scopeOrdersProcessed,
        tickets_created: scopeTicketsCreated,
        errors: scopeErrors.length > 0 ? scopeErrors : undefined
      });

      console.log(`[KDS BACKFILL ALL] Completed ${scope} scope: ${scopeOrdersProcessed} orders, ${scopeTicketsCreated} tickets`);
    }

    console.log('[KDS BACKFILL ALL] Comprehensive backfill completed:', {
      totalOrdersProcessed,
      totalTicketsCreated,
      results
    });

    return NextResponse.json({ 
      ok: true, 
      message: 'Comprehensive KDS backfill completed',
      total_orders_processed: totalOrdersProcessed,
      total_tickets_created: totalTicketsCreated,
      results
    });

  } catch (error: any) {
    console.error('[KDS BACKFILL ALL] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Comprehensive backfill failed' 
    }, { status: 500 });
  }
}
