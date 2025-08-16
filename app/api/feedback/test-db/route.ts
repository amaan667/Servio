import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: Request) {
  const supabase = getSupabaseClient();
  
  try {
    const { searchParams } = new URL(req.url);
    const venue_id = searchParams.get('venue_id') || 'test-venue';
    
    // Test if feedback_questions table exists
    const { data: questionsData, error: questionsError } = await supabase
      .from('feedback_questions')
      .select('count')
      .limit(1);

    // Test if feedback_responses table exists
    const { data: responsesData, error: responsesError } = await supabase
      .from('feedback_responses')
      .select('count')
      .limit(1);

    // Test inserting a question
    const testQuestion = {
      venue_id: venue_id,
      question: 'Test question',
      question_type: 'rating',
      options: null,
      active: true
    };

    const { data: insertData, error: insertError } = await supabase
      .from('feedback_questions')
      .insert(testQuestion)
      .select()
      .single();

    // Clean up test data
    if (insertData?.id) {
      await supabase
        .from('feedback_questions')
        .delete()
        .eq('id', insertData.id);
    }

    return NextResponse.json({
      ok: true,
      tables: {
        feedback_questions: {
          exists: !questionsError,
          error: questionsError?.message
        },
        feedback_responses: {
          exists: !responsesError,
          error: responsesError?.message
        }
      },
      insert_test: {
        success: !insertError,
        error: insertError?.message,
        data: insertData
      }
    });

  } catch (error: any) {
    console.error('[FEEDBACK_TEST_DB] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Database test failed: ${error.message}` 
    }, { status: 500 });
  }
}
