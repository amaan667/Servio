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
    const { question_id, active } = await req.json();
    
    console.log('[FEEDBACK_TOGGLE_QUESTION] Request data:', { question_id, active });
    
    if (!question_id || active === undefined) {
      return NextResponse.json({ 
        ok: false, 
        error: 'question_id and active are required' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('feedback_questions')
      .update({ active })
      .eq('id', question_id)
      .select()
      .single();

    if (error) {
      console.error('[FEEDBACK_TOGGLE_QUESTION] Database error:', error);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to update question: ${error.message}` 
      }, { status: 500 });
    }

    console.log('[FEEDBACK_TOGGLE_QUESTION] Successfully updated question:', data);

    return NextResponse.json({
      ok: true,
      data: data
    });

  } catch (error: any) {
    console.error('[FEEDBACK_TOGGLE_QUESTION] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Failed to update question: ${error.message}` 
    }, { status: 500 });
  }
}
