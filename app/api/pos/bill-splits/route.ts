import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      venue_id, 
      table_session_id, 
      counter_session_id, 
      splits, 
      action 
    } = body;

    if (!venue_id || !splits || !Array.isArray(splits)) {
      return NextResponse.json({ error: 'venue_id and splits array are required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let result;

    switch (action) {
      case 'create_splits':
        // Create bill splits
        const billSplits = [];
        
        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];
          
          // Create bill split record
          const { data: billSplit, error: splitError } = await supabase
            .from('bill_splits')
            .insert({
              venue_id,
              table_session_id,
              counter_session_id,
              split_number: i + 1,
              total_amount: split.total_amount,
              payment_status: 'UNPAID'
            })
            .select()
            .single();

          if (splitError) {
            logger.error('[POS BILL SPLITS] Error creating split:', splitError);
            return NextResponse.json({ error: 'Failed to create bill split' }, { status: 500 });
          }

          // Link orders to this split
          if (split.order_ids && split.order_ids.length > 0) {
            const orderSplitLinks = split.order_ids.map((orderId: string) => ({
              order_id: orderId,
              bill_split_id: billSplit.id,
              amount: split.total_amount / split.order_ids.length
            }));

            const { error: linksError } = await supabase
              .from('order_bill_splits')
              .insert(orderSplitLinks);

            if (linksError) {
              logger.error('[POS BILL SPLITS] Error linking orders:', linksError);
              return NextResponse.json({ error: 'Failed to link orders to split' }, { status: 500 });
            }
          }

          billSplits.push(billSplit);
        }

        result = { splits: billSplits, action: 'created' };
        break;

      case 'pay_split':
        const { split_id, payment_method } = body;
        
        if (!split_id || !payment_method) {
          return NextResponse.json({ error: 'split_id and payment_method are required' }, { status: 400 });
        }

        // Mark split as paid
        const { data: paidSplit, error: payError } = await supabase
          .from('bill_splits')
          .update({ 
            payment_status: 'PAID',
            payment_method
          })
          .eq('id', split_id)
          .eq('venue_id', venue_id)
          .select()
          .single();

        if (payError) {
          logger.error('[POS BILL SPLITS] Error paying split:', payError);
          return NextResponse.json({ error: 'Failed to mark split as paid' }, { status: 500 });
        }

        result = { split: paidSplit, action: 'paid' };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (_error) {
    logger.error('[POS BILL SPLITS] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id');
    const tableSessionId = searchParams.get('table_session_id');
    const counterSessionId = searchParams.get('counter_session_id');

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check venue ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('bill_splits')
      .select(`
        *,
        order_bill_splits (
          order_id,
          amount,
          orders (
            id,
            customer_name,
            total_amount,
            order_status
          )
        )
      `)
      .eq('venue_id', venueId);

    if (tableSessionId) {
      query = query.eq('table_session_id', tableSessionId);
    }

    if (counterSessionId) {
      query = query.eq('counter_session_id', counterSessionId);
    }

    const { data: splits, error } = await query.order('split_number');

    if (error) {
      logger.error('[POS BILL SPLITS] Error fetching splits:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ splits });
  } catch (_error) {
    logger.error('[POS BILL SPLITS] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
