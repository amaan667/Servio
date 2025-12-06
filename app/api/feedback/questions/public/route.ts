import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { apiErrors } from '@/lib/api/standard-response';

// GET - List active questions for venue (public endpoint for customers)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return apiErrors.badRequest('venueId required');
    }

    // Normalize venueId - database stores with venue- prefix
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    const serviceClient = await createAdminClient();

    // Get active questions for the venue
    const { data: questions, error } = await serviceClient
      .from('feedback_questions')
      .select('*')
      .eq('venue_id', normalizedVenueId)
      .eq('is_active', true)
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('[FEEDBACK:PUBLIC] Error fetching questions:', { error: error.message });
      return apiErrors.internal('Failed to fetch questions');
    }

    // Transform questions to match frontend expectations (prompt, type, choices)
    const transformedQuestions = (questions || []).map((q: {
      id: string;
      question_text: string;
      question_type: string;
      options: string[] | null;
      is_active: boolean;
      sort_index: number;
      created_at: string;
      updated_at: string;
      venue_id: string;
    }) => ({
      id: q.id,
      prompt: q.question_text, // Map 'question_text' to 'prompt' for frontend
      type: q.question_type, // Map 'question_type' to 'type' for frontend
      choices: q.options || [], // Map 'options' to 'choices' for frontend
      is_active: q.is_active,
      sort_index: q.sort_index,
      created_at: q.created_at,
      updated_at: q.updated_at,
      venue_id: q.venue_id,
    }));

    return NextResponse.json({ 
      questions: transformedQuestions,
      count: transformedQuestions.length
    });

  } catch (_error) {
    logger.error('[FEEDBACK:PUBLIC] Exception:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return apiErrors.internal('Internal server error');
  }
}
