import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

// GET - List active questions for venue (public endpoint for customers)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return apiErrors.badRequest('venueId required');
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
      return apiErrors.internal('Failed to fetch questions');
    }

    return NextResponse.json({ 
      questions: questions || [],
      count: questions?.length || 0
    });

  } catch (_error) {
    logger.error('[FEEDBACK:PUBLIC] Exception:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return apiErrors.internal('Internal server error');
  }
}
