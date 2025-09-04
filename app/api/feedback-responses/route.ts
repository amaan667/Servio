import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { FeedbackAnswer } from '@/types/feedback';

export const runtime = 'nodejs';

function getServiceClient() {
  return createAdminClient();
}

// POST - Submit feedback responses
export async function POST(req: Request) {
  try {
    const { venue_id, order_id, answers } = await req.json();

    if (!venue_id || !answers || !Array.isArray(answers) || answers.length === 0) {
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

    // Verify questions exist and are active
    const serviceClient = getServiceClient();
    const questionIds = answers.map(a => a.question_id);
    
    const { data: questions, error: questionsError } = await serviceClient
      .from('feedback_questions')
      .select('id, type, choices')
      .in('id', questionIds)
      .eq('venue_id', venue_id)
      .eq('is_active', true);

    if (questionsError) {
      console.error('[FEEDBACK][R] questions fetch error:', questionsError.message);
      return NextResponse.json({ error: 'Failed to validate questions' }, { status: 500 });
    }

    if (!questions || questions.length !== answers.length) {
      return NextResponse.json({ error: 'Some questions not found or inactive' }, { status: 400 });
    }

    // Validate answer choices for multiple choice questions
    for (const answer of answers) {
      if (answer.type === 'multiple_choice') {
        const question = questions.find(q => q.id === answer.question_id);
        if (question && question.choices && !question.choices.includes(answer.answer_choice)) {
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

    // Create single feedback entry
    const feedbackData = {
      venue_id,
      order_id: order_id || null,
      customer_name: 'Customer',
      customer_email: null,
      customer_phone: null,
      rating: averageRating,
      comment: comment || 'No additional comments',
      category: 'structured',
      feedback_type: 'structured',
      sentiment_score: null,
      sentiment_label: null,
      response: null,
      responded_at: null
    };

    // Insert feedback
    const { data, error } = await serviceClient
      .from('feedback')
      .insert(feedbackData)
      .select('id');

    if (error) {
      console.error('[FEEDBACK][R] insert error:', error.message);
      return NextResponse.json({ 
        error: 'Failed to save responses' 
      }, { status: 500 });
    }

    console.log(`[FEEDBACK][R] insert venue=${venue_id} count=${data?.length || 0}`);
    return NextResponse.json({
      success: true,
      saved_count: data?.length || 0
    });

  } catch (error: any) {
    console.error('[FEEDBACK][R] insert exception:', error.message);
    return NextResponse.json({ 
      error: 'Failed to submit feedback' 
    }, { status: 500 });
  }
}
