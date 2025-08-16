import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Default questions when no custom questions exist
const DEFAULT_QUESTIONS = [
  {
    id: 'default-service',
    question: 'How was the service?',
    question_type: 'rating' as const,
    options: null,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'default-staff',
    question: 'How was the staff?',
    question_type: 'rating' as const,
    options: null,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'default-food',
    question: 'How was the food quality?',
    question_type: 'rating' as const,
    options: null,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'default-overall',
    question: 'Overall experience?',
    question_type: 'rating' as const,
    options: null,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'default-comments',
    question: 'Any additional comments?',
    question_type: 'text' as const,
    options: null,
    active: true,
    created_at: new Date().toISOString()
  }
];

export async function GET(req: Request) {
  const supabase = getSupabaseClient();
  
  try {
    const { searchParams } = new URL(req.url);
    const venue_id = searchParams.get('venue_id');
    
    if (!venue_id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venue_id is required' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('feedback_questions')
      .select('*')
      .eq('venue_id', venue_id)
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[FEEDBACK_QUESTIONS] Database error:', error);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to fetch questions: ${error.message}` 
      }, { status: 500 });
    }

    // If no custom questions exist, return default questions
    // Otherwise return the custom questions
    const questions = (data && data.length > 0) ? data : DEFAULT_QUESTIONS;

    return NextResponse.json({
      ok: true,
      questions: questions,
      isDefault: !data || data.length === 0
    });

  } catch (error: any) {
    console.error('[FEEDBACK_QUESTIONS] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Failed to fetch questions: ${error.message}` 
    }, { status: 500 });
  }
}
