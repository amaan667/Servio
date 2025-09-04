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

    // Prepare response data
    const responseData = answers.map((answer: FeedbackAnswer) => {
      const base = {
        venue_id,
        order_id: order_id || null,
        question_id: answer.question_id
      };

      switch (answer.type) {
        case 'stars':
          return { ...base, answer_stars: answer.answer_stars };
        case 'multiple_choice':
          return { ...base, answer_choice: answer.answer_choice };
        case 'paragraph':
          return { ...base, answer_text: answer.answer_text };
        default:
          throw new Error('Invalid answer type');
      }
    });

    // Insert responses
    const { data, error } = await serviceClient
      .from('feedback_responses')
      .insert(responseData)
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
