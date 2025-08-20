import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { FeedbackQuestion } from '@/types/feedback';

export const runtime = 'nodejs';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET - List questions for a venue
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    // Get user session for auth check
    const jar = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify venue ownership
    const { data: venue } = await supa
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get questions using service role
    const serviceClient = getServiceClient();
    const { data: questions, error } = await serviceClient
      .from('feedback_questions')
      .select('*')
      .eq('venue_id', venueId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FEEDBACK][Q] list error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    console.log(`[FEEDBACK][Q] list venue=${venueId} count=${questions?.length || 0}`);
    return NextResponse.json({ questions: questions || [] });

  } catch (error: any) {
    console.error('[FEEDBACK][Q] list exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new question
export async function POST(req: Request) {
  try {
    const { venue_id, prompt, type, choices, is_active = true, order_index = 0 } = await req.json();

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

    if (type === 'multiple_choice' && (!choices || !Array.isArray(choices) || choices.length < 2)) {
      return NextResponse.json({ error: 'Multiple choice questions require at least 2 choices' }, { status: 400 });
    }

    // Auth check
    const jar = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: venue } = await supa
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venue_id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create question
    const serviceClient = getServiceClient();
    const questionData = {
      venue_id,
      prompt: prompt.trim(),
      type,
      choices: type === 'multiple_choice' ? choices : null,
      is_active,
      order_index
    };

    const { data: question, error } = await serviceClient
      .from('feedback_questions')
      .insert(questionData)
      .select()
      .single();

    if (error) {
      console.error('[FEEDBACK][Q] create error:', error.message);
      return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
    }

    console.log(`[FEEDBACK][Q] create venue=${venue_id} id=${question.id}`);
    return NextResponse.json({ question });

  } catch (error: any) {
    console.error('[FEEDBACK][Q] create exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update questions (toggle, edit, reorder)
export async function PATCH(req: Request) {
  try {
    const { id, is_active, prompt, type, choices, updates } = await req.json();

    // Auth check
    const jar = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Handle different update types
    if (updates && Array.isArray(updates)) {
      // Bulk reorder
      for (const update of updates) {
        if (!update.id || typeof update.order_index !== 'number') {
          return NextResponse.json({ error: 'Invalid reorder data' }, { status: 400 });
        }
      }

      const { error } = await serviceClient
        .from('feedback_questions')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error('[FEEDBACK][Q] reorder error:', error.message);
        return NextResponse.json({ error: 'Failed to reorder questions' }, { status: 500 });
      }

      console.log(`[FEEDBACK][Q] reorder count=${updates.length}`);
      return NextResponse.json({ success: true });

    } else if (id) {
      // Single question update
      const updateData: any = {};
      
      if (typeof is_active === 'boolean') {
        updateData.is_active = is_active;
      }
      
      if (prompt) {
        if (prompt.length < 4 || prompt.length > 160) {
          return NextResponse.json({ error: 'Prompt must be 4-160 characters' }, { status: 400 });
        }
        updateData.prompt = prompt.trim();
      }
      
      if (type) {
        if (!['stars', 'multiple_choice', 'paragraph'].includes(type)) {
          return NextResponse.json({ error: 'Invalid question type' }, { status: 400 });
        }
        updateData.type = type;
        updateData.choices = type === 'multiple_choice' ? choices : null;
      }

      const { data: question, error } = await serviceClient
        .from('feedback_questions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[FEEDBACK][Q] update error:', error.message);
        return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
      }

      console.log(`[FEEDBACK][Q] update id=${id}`);
      return NextResponse.json({ question });

    } else {
      return NextResponse.json({ error: 'Invalid update data' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[FEEDBACK][Q] update exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete question
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Question ID required' }, { status: 400 });
    }

    // Auth check
    const jar = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from('feedback_questions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[FEEDBACK][Q] delete error:', error.message);
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
    }

    console.log(`[FEEDBACK][Q] delete id=${id}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[FEEDBACK][Q] delete exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
