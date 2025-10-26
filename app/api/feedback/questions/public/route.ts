import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// GET - List active questions for venue (public endpoint for customers)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    const serviceClient = await createAdminClient();

    // Get active questions for the venue
    const { data: questions, error } = await serviceClient
      .from('feedback_questions')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('[FEEDBACK:PUBLIC] Error fetching questions:', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    
    return NextResponse.json({ 
      questions: questions || [],
      count: questions?.length || 0
    });

  } catch (_error) {
    logger.error('[FEEDBACK:PUBLIC] Exception:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
