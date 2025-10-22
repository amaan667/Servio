import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { venue_id } = await req.json();
    
    if (!venue_id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venue_id is required' 
      }, { status: 400 });
    }

    // Get user session
    const supa = await createServerSupabase();

    const { data: { session } } = await supa.auth.getSession();
    const user = session?.user;
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Verify venue ownership
    const { data: venue, error: venueError } = await supa
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (venueError || !venue) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Access denied to this venue' 
      }, { status: 403 });
    }

    // Fetch feedback for orders from this venue
    const { data: feedback, error } = await supa
      .from('order_feedback')
      .select(`
        id,
        created_at,
        rating,
        comment,
        order_id,
        orders!inner(venue_id)
      `)
      .eq('orders.venue_id', venue_id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[AUTH DEBUG] Error fetching feedback:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to fetch feedback' 
      }, { status: 500 });
    }

    // Transform the data to match the expected format
    const transformedFeedback = feedback?.map(f => ({
      id: f.id,
      created_at: f.created_at,
      rating: f.rating,
      comment: f.comment,
      order_id: f.order_id
    })) || [];

    return NextResponse.json({
      ok: true,
      feedback: transformedFeedback
    });

  } catch (error) {
    logger.error('[AUTH DEBUG] Error in feedback list:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: `Failed to fetch feedback: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
