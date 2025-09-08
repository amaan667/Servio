import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Session ID is required' 
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );

    console.log('[ORDERS SESSION] Looking for open order with session:', sessionId);

    // Find any unpaid order for this session
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('session_id', sessionId)
      .eq('payment_status', 'unpaid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('[ORDERS SESSION] Error fetching order:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch order' 
      }, { status: 500 });
    }

    if (!order) {
      console.log('[ORDERS SESSION] No open order found for session:', sessionId);
      return NextResponse.json({
        success: true,
        data: null
      });
    }

    console.log('[ORDERS SESSION] Found open order:', order.id);

    return NextResponse.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('[ORDERS SESSION] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
