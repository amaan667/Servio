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
    // Try to order by display_order first, fall back to created_at if column doesn't exist
    let questions;
    let error;
    
    const resultWithDisplayOrder = await serviceClient
      .from('feedback_questions')
      .select('*')
      .eq('venue_id', normalizedVenueId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    
    questions = resultWithDisplayOrder.data;
    error = resultWithDisplayOrder.error;
    
    // If error is about missing display_order column, retry without it
    if (error && error.message?.toLowerCase().includes("display_order") && 
        (error.message?.toLowerCase().includes("column") || error.message?.toLowerCase().includes("could not find"))) {
      logger.warn('[FEEDBACK:PUBLIC] display_order column not found, ordering by created_at only', {
        error: error.message,
      });
      
      const resultWithoutDisplayOrder = await serviceClient
        .from('feedback_questions')
        .select('*')
        .eq('venue_id', normalizedVenueId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      questions = resultWithoutDisplayOrder.data;
      error = resultWithoutDisplayOrder.error;
    }

    if (error) {
      logger.error('[FEEDBACK:PUBLIC] Error fetching questions:', { error: error.message });
      return apiErrors.internal('Failed to fetch questions');
    }

    // Transform questions to match frontend expectations (prompt, type, choices)
    const transformedQuestions = (questions || []).map((q: {
      id: string;
      question?: string;
      question_text?: string;
      question_type: string;
      options?: string[] | null;
      is_active: boolean;
      display_order?: number;
      created_at: string;
      updated_at: string;
      venue_id: string;
    }) => ({
      id: q.id,
      prompt: q.question_text || q.question || "", // Map 'question_text' or 'question' to 'prompt' for frontend
      type: q.question_type, // Map 'question_type' to 'type' for frontend
      choices: q.options || [], // Map 'options' to 'choices' for frontend
      is_active: q.is_active,
      sort_index: q.display_order ?? 0, // Map 'display_order' to 'sort_index' for frontend, default to 0 if missing
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
