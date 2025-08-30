import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';
import type { FeedbackQuestion } from '@/types/feedback';

export const runtime = 'nodejs';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient();
}

// GET - List questions for venue
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    // Auth check
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const supa = await createClient();

    const { data: venue } = await supa
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get questions
    const serviceClient = getServiceClient();
    const { data: questions, error } = await serviceClient
      .from('feedback_questions')
      .select('*')
      .eq('venue_id', venueId)
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[FEEDBACK:Q] list error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    console.log(`[FEEDBACK:Q] list venue=${venueId} count=${questions?.length || 0}`);
    return NextResponse.json({ questions: questions || [] });

  } catch (error: any) {
    console.error('[FEEDBACK:Q] list exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new question
export async function POST(req: Request) {
  try {
    const { venue_id, prompt, type, choices, is_active = true } = await req.json();

    // Validate inputs
    if (!venue_id || !prompt || !type) {
      return NextResponse.json({ error: 'venue_id, prompt, and type required' }, { status: 400 });
    }

    if (prompt.length < 4 || prompt.length > 160) {
      return NextResponse.json({ error: 'Prompt must be 4-160 characters' }, { status: 400 });
    }

    if (!['stars', 'multiple_choice', 'paragraph'].includes(type)) {
      return NextResponse.json({ error: 'Invalid question type' }, { status: 400 });
    }

    if (type === 'multiple_choice') {
      if (!choices || !Array.isArray(choices) || choices.length < 2 || choices.length > 6) {
        return NextResponse.json({ error: 'Multiple choice questions require 2-6 choices' }, { status: 400 });
      }
      
      for (const choice of choices) {
        if (!choice || typeof choice !== 'string' || choice.length === 0 || choice.length > 40) {
          return NextResponse.json({ error: 'Each choice must be 1-40 characters' }, { status: 400 });
        }
      }
    }

    // Auth check
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const supa = await createClient();

    const { data: venue } = await supa
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get max sort_index for this venue
    const serviceClient = getServiceClient();
    const { data: maxSort, error: maxSortError } = await serviceClient
      .from('feedback_questions')
      .select('sort_index')
      .eq('venue_id', venue_id)
      .order('sort_index', { ascending: false })
      .limit(1)
      .single();

    if (maxSortError && maxSortError.message.includes('sort_index')) {
      console.error('[FEEDBACK:Q] Database schema error - sort_index column missing');
      return NextResponse.json({ 
        error: 'Database schema not set up. Please contact support to apply the feedback questions schema.' 
      }, { status: 500 });
    }

    const sort_index = (maxSort?.sort_index || 0) + 1;

    // Create question
    const questionData = {
      venue_id,
      prompt: prompt.trim(),
      type,
      choices: type === 'multiple_choice' ? choices : null,
      is_active,
      sort_index
    };

    const { data: question, error } = await serviceClient
      .from('feedback_questions')
      .insert(questionData)
      .select()
      .single();

    if (error) {
      console.error('[FEEDBACK:Q] add error:', error.message);
      return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
    }

    console.log(`[FEEDBACK:Q] add venue=${venue_id} type=${type} id=${question.id}`);
    return NextResponse.json({ question });

  } catch (error: any) {
    console.error('[FEEDBACK:Q] add exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update question
export async function PATCH(req: Request) {
  try {
    const { id, venue_id, prompt, type, choices, is_active, sort_index } = await req.json();

    if (!id || !venue_id) {
      return NextResponse.json({ error: 'id and venue_id required' }, { status: 400 });
    }

    // Auth check
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const supa = await createClient();

    const { data: venue } = await supa
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const serviceClient = getServiceClient();
    const updateData: any = {};

    if (prompt !== undefined) {
      if (prompt.length < 4 || prompt.length > 160) {
        return NextResponse.json({ error: 'Prompt must be 4-160 characters' }, { status: 400 });
      }
      updateData.prompt = prompt.trim();
    }

    if (type !== undefined) {
      if (!['stars', 'multiple_choice', 'paragraph'].includes(type)) {
        return NextResponse.json({ error: 'Invalid question type' }, { status: 400 });
      }
      updateData.type = type;
      updateData.choices = type === 'multiple_choice' ? choices : null;
    }

    if (choices !== undefined && type === 'multiple_choice') {
      if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) {
        return NextResponse.json({ error: 'Multiple choice questions require 2-6 choices' }, { status: 400 });
      }
      
      for (const choice of choices) {
        if (!choice || typeof choice !== 'string' || choice.length === 0 || choice.length > 40) {
          return NextResponse.json({ error: 'Each choice must be 1-40 characters' }, { status: 400 });
        }
      }
      updateData.choices = choices;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    if (sort_index !== undefined) {
      updateData.sort_index = sort_index;
    }

    const { data: question, error } = await serviceClient
      .from('feedback_questions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[FEEDBACK:Q] update error:', error.message);
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
    }

    console.log(`[FEEDBACK:Q] update id=${id}`);
    return NextResponse.json({ question });

  } catch (error: any) {
    console.error('[FEEDBACK:Q] update exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete question
export async function DELETE(req: Request) {
  try {
    const { id, venue_id } = await req.json();

    if (!id || !venue_id) {
      return NextResponse.json({ error: 'id and venue_id required' }, { status: 400 });
    }

    // Auth check
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const supa = await createClient();

    const { data: venue } = await supa
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from('feedback_questions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[FEEDBACK:Q] delete error:', error.message);
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
    }

    console.log(`[FEEDBACK:Q] delete id=${id}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[FEEDBACK:Q] delete exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
