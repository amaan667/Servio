import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  const supabase = getSupabaseClient();
  
  try {
    const { venue_id, order_id, customer_name, comments, responses } = await req.json();
    
    if (!venue_id || !responses || !Array.isArray(responses)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venue_id and responses array are required' 
      }, { status: 400 });
    }

    // Validate responses structure
    for (const response of responses) {
      if (!response.question_id || !response.response) {
        return NextResponse.json({ 
          ok: false, 
          error: 'Each response must have question_id and response' 
        }, { status: 400 });
      }
    }

    // Insert all responses
    const responseData = responses.map((r: any) => ({
      venue_id,
      question_id: r.question_id,
      order_id: order_id || null,
      response: r.response,
      rating: r.rating || null,
      customer_name: customer_name || null,
      comments: comments || null
    }));

    const { data, error } = await supabase
      .from('feedback_responses')
      .insert(responseData)
      .select('id');

    if (error) {
      console.error('[FEEDBACK_SUBMIT] Database error:', error);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to save feedback: ${error.message}` 
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      saved_count: data?.length || 0
    });

  } catch (error: any) {
    console.error('[FEEDBACK_SUBMIT] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Feedback submission failed: ${error.message}` 
    }, { status: 500 });
  }
}
