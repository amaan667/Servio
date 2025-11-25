import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// POST - Submit feedback responses
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const venueId = body?.venue_id || body?.venueId;
    const { order_id, answers } = body;

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    if (!venueId || !answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ 
        error: 'venue_id and answers array required' 
      }, { status: 400 });
    }

    // Validate answers structure
    for (const answer of answers) {
      if (!answer.question_id || !answer.type) {
        return NextResponse.json({ 
          error: 'Each answer must have question_id and type' 
        }, { status: 400 });
      }

      // Validate answer content based on type
      switch (answer.type) {
        case 'stars':
          if (typeof answer.answer_stars !== 'number' || answer.answer_stars < 1 || answer.answer_stars > 5) {
            return NextResponse.json({ 
              error: 'Stars answers must be 1-5' 
            }, { status: 400 });
          }
          break;
        case 'multiple_choice':
          if (!answer.answer_choice || typeof answer.answer_choice !== 'string') {
            return NextResponse.json({ 
              error: 'Multiple choice answers must have answer_choice' 
            }, { status: 400 });
          }
          break;
        case 'paragraph':
          if (!answer.answer_text || typeof answer.answer_text !== 'string') {
            return NextResponse.json({ 
              error: 'Paragraph answers must have answer_text' 
            }, { status: 400 });
          }
          if (answer.answer_text.length > 600) {
            return NextResponse.json({ 
              error: 'Paragraph answers must be 600 characters or less' 
            }, { status: 400 });
          }
          break;
        default:
          return NextResponse.json({ 
            error: 'Invalid answer type' 
          }, { status: 400 });
      }
    }

    // Verify questions exist and are active (skip validation for generic questions)
    const supabase = await createClient();
    const questionIds = answers.map(a => a.question_id);
    
    // Filter out generic questions (they start with 'generic-')
    const nonGenericQuestionIds = questionIds.filter(id => !id.startsWith('generic-'));
    
    let questions: Array<Record<string, unknown>> = [];
    if (nonGenericQuestionIds.length > 0) {
      const { data: dbQuestions, error: questionsError } = await supabase
        .from('feedback_questions')
        .select('id, type, choices')
        .in('id', nonGenericQuestionIds)
        .eq('venue_id', venueId)
        .eq('is_active', true);

      if (questionsError) {
        logger.error('[FEEDBACK][R] questions fetch error:', { error: questionsError.message });
        return NextResponse.json({ error: 'Failed to validate questions' }, { status: 500 });
      }
      
      questions = dbQuestions || [];
    }
    
    // For generic questions, we'll create mock question data for validation
    const genericQuestions = questionIds
      .filter(id => id.startsWith('generic-'))
      .map(id => {
        // Create mock question data based on the generic question ID
        if (id === 'generic-recommendation') {
          return {
            id,
            type: 'multiple_choice',
            choices: ['Yes, definitely', 'Yes, probably', 'Maybe', 'No, probably not', 'No, definitely not']
          };
        }
        return {
          id,
          type: 'stars',
          choices: null
        };
      });
    
    const allQuestions = [...questions, ...genericQuestions];

    // Validate answer choices for multiple choice questions
    for (const answer of answers) {
      if (answer.type === 'multiple_choice') {
        const question = allQuestions.find(q => (q as { id?: string }).id === answer.question_id) as { choices?: string[] } | undefined;
        const choices = question?.choices || [];
        if (question && choices.length > 0 && !choices.includes(answer.answer_choice)) {
          return NextResponse.json({ 
            error: 'Invalid choice for multiple choice question' 
          }, { status: 400 });
        }
      }
    }

    // Calculate average rating from star responses
    const starAnswers = answers.filter(a => a.type === 'stars' && a.answer_stars > 0);
    const averageRating = starAnswers.length > 0 
      ? Math.round(starAnswers.reduce((sum, a) => sum + a.answer_stars, 0) / starAnswers.length)
      : 3; // Default rating

    // Combine text responses into comment
    const textAnswers = answers.filter(a => a.type === 'paragraph' && a.answer_text?.trim());
    const comment = textAnswers.length > 0 
      ? textAnswers.map(a => a.answer_text).join('\n\n')
      : '';

    // Calculate sentiment based on rating
    let sentimentLabel: 'positive' | 'negative' | 'neutral';
    let sentimentScore: number;
    
    if (averageRating >= 4) {
      sentimentLabel = 'positive';
      sentimentScore = 0.8 + (averageRating - 4) * 0.1;
    } else if (averageRating <= 2) {
      sentimentLabel = 'negative';
      sentimentScore = 0.2 - (2 - averageRating) * 0.1;
    } else {
      sentimentLabel = 'neutral';
      sentimentScore = 0.5;
    }

    // Get customer name from order if available
    let customerName = 'Customer';
    if (order_id) {
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('customer_name')
          .eq('id', order_id)
          .single();
        
        if (orderData?.customer_name) {
          customerName = orderData.customer_name;
        }
      } catch {
        // Ignore errors fetching order data
      }
    }

    // Create single feedback entry
    const feedbackData = {
      venue_id: venueId,
      order_id: order_id || null,
      customer_name: customerName,
      customer_email: null,
      customer_phone: null,
      rating: averageRating,
      comment: comment || 'No additional comments',
      category: 'Customer Experience',
      sentiment_score: sentimentScore,
      sentiment_label: sentimentLabel,
      response: null,
      responded_at: null
    };

    // Insert feedback
    const { data, error } = await supabase
      .from('feedback')
      .insert(feedbackData)
      .select('id');

    if (error) {
      logger.error('[FEEDBACK][R] insert error:', { error: error.message });
      return NextResponse.json({ 
        error: 'Failed to save responses' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      saved_count: data?.length || 0
    });

  } catch (error: unknown) {
    logger.error('[FEEDBACK][R] insert exception:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      error: 'Failed to submit feedback' 
    }, { status: 500 });
  }
}
