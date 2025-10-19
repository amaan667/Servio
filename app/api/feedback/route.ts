import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { order_id, rating, comment } = await req.json();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = await createClient();
    
    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Valid rating (1-5) is required' 
      }, { status: 400 });
    }

    // Validate comment length
    const trimmedComment = comment ? comment.trim().slice(0, 500) : null;
    
    // Prepare data for insertion
    const feedbackData = {
      order_id: order_id || null,
      rating,
      comment: trimmedComment
    };


    const { error } = await admin
      .from('order_feedback')
      .insert(feedbackData);

    if (error) {
      logger.error('[AUTH DEBUG] Feedback submission error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json({ 
        ok: false, 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
    
  } catch (e: any) {
    logger.error('[AUTH DEBUG] Feedback submission exception:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e.message 
    }, { status: 500 });
  }
}
