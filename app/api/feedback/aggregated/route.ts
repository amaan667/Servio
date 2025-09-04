import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function getServiceClient() {
  return createAdminClient();
}

// GET - Get aggregated feedback from both feedback and feedback_responses tables
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    // Get feedback from the main feedback table
    const { data: mainFeedback, error: mainError } = await serviceClient
      .from('feedback')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (mainError) {
      console.error('[FEEDBACK:AGGREGATED] Main feedback error:', mainError.message);
    }

    // Get feedback responses and aggregate them
    const { data: responses, error: responsesError } = await serviceClient
      .from('feedback_responses')
      .select(`
        *,
        feedback_questions!inner(
          id,
          prompt,
          type,
          venue_id
        )
      `)
      .eq('feedback_questions.venue_id', venueId)
      .order('created_at', { ascending: false });

    if (responsesError) {
      console.error('[FEEDBACK:AGGREGATED] Responses error:', responsesError.message);
    }

    // Group responses by order_id to create aggregated feedback entries
    const aggregatedResponses: any[] = [];
    const responseGroups = new Map();

    if (responses) {
      responses.forEach((response: any) => {
        const orderId = response.order_id || 'no-order';
        if (!responseGroups.has(orderId)) {
          responseGroups.set(orderId, {
            id: `aggregated-${orderId}`,
            venue_id: venueId,
            order_id: response.order_id,
            customer_name: 'Customer',
            customer_email: null,
            customer_phone: null,
            rating: 0,
            comment: '',
            category: 'aggregated',
            sentiment_score: null,
            sentiment_label: null,
            response: null,
            responded_at: null,
            created_at: response.created_at,
            updated_at: response.created_at,
            responses: []
          });
        }
        
        const group = responseGroups.get(orderId);
        group.responses.push({
          question: response.feedback_questions.prompt,
          type: response.feedback_questions.type,
          answer: response.answer_stars || response.answer_choice || response.answer_text,
          created_at: response.created_at
        });

        // Calculate average rating from star responses
        if (response.answer_stars) {
          const starResponses = group.responses.filter((r: any) => r.type === 'stars' && r.answer);
          if (starResponses.length > 0) {
            group.rating = Math.round(starResponses.reduce((sum: number, r: any) => sum + r.answer, 0) / starResponses.length);
          }
        }

        // Combine text responses into comment
        const textResponses = group.responses.filter((r: any) => r.type === 'paragraph' && r.answer);
        if (textResponses.length > 0) {
          group.comment = textResponses.map((r: any) => `${r.question}: ${r.answer}`).join('\n\n');
        }
      });

      // Convert map to array
      responseGroups.forEach((group) => {
        aggregatedResponses.push(group);
      });
    }

    // Combine main feedback and aggregated responses
    const allFeedback = [
      ...(mainFeedback || []),
      ...aggregatedResponses
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Calculate stats
    const totalFeedback = allFeedback.length;
    const ratings = allFeedback.filter(f => f.rating > 0).map(f => f.rating);
    const averageRating = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
    
    const positiveSentiment = allFeedback.filter(f => f.sentiment_label === 'positive').length;
    const negativeSentiment = allFeedback.filter(f => f.sentiment_label === 'negative').length;
    const neutralSentiment = allFeedback.filter(f => f.sentiment_label === 'neutral').length;
    
    const respondedCount = allFeedback.filter(f => f.response).length;
    const responseRate = totalFeedback > 0 ? (respondedCount / totalFeedback) * 100 : 0;

    const stats = {
      totalFeedback,
      averageRating,
      positiveSentiment,
      negativeSentiment,
      neutralSentiment,
      responseRate,
      topCategories: [],
      ratingDistribution: [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: allFeedback.filter(f => f.rating === rating).length,
        percentage: totalFeedback > 0 ? (allFeedback.filter(f => f.rating === rating).length / totalFeedback) * 100 : 0
      }))
    };

    console.log(`[FEEDBACK:AGGREGATED] venue=${venueId} main=${mainFeedback?.length || 0} responses=${responses?.length || 0} aggregated=${aggregatedResponses.length} total=${allFeedback.length}`);
    
    return NextResponse.json({
      feedback: allFeedback,
      stats
    });

  } catch (error: any) {
    console.error('[FEEDBACK:AGGREGATED] exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
