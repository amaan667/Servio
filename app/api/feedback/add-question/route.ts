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
    const { venue_id, question, question_type, options, active } = await req.json();
    
    console.log('[FEEDBACK_ADD_QUESTION] Request data:', { venue_id, question, question_type, options, active });
    
    if (!venue_id || !question || !question_type) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venue_id, question, and question_type are required' 
      }, { status: 400 });
    }

    const questionData = {
      venue_id,
      question: question.trim(),
      question_type,
      options: question_type === 'multiple_choice' ? options : null,
      active: active !== undefined ? active : true
    };

    console.log('[FEEDBACK_ADD_QUESTION] Inserting question:', questionData);

    const { data, error } = await supabase
      .from('feedback_questions')
      .insert(questionData)
      .select()
      .single();

    if (error) {
      console.error('[FEEDBACK_ADD_QUESTION] Database error:', error);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to add question: ${error.message}` 
      }, { status: 500 });
    }

    console.log('[FEEDBACK_ADD_QUESTION] Successfully added question:', data);

    return NextResponse.json({
      ok: true,
      data: data
    });

  } catch (error: any) {
    console.error('[FEEDBACK_ADD_QUESTION] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Failed to add question: ${error.message}` 
    }, { status: 500 });
  }
}
