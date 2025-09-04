import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function getServiceClient() {
  return createAdminClient();
}

// GET - List questions for venue (public endpoint for customers)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    // Get questions (no auth required for public access)
    const serviceClient = getServiceClient();
    const { data: questions, error } = await serviceClient
      .from('feedback_questions')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true) // Only get active questions
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[FEEDBACK:Q:PUBLIC] list error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    // Calculate counts
    const totalCount = questions?.length || 0;
    const activeCount = questions?.filter(q => q.is_active).length || 0;

    console.log(`[FEEDBACK:Q:PUBLIC] list venue=${venueId} count=${questions?.length || 0} total=${totalCount} active=${activeCount}`);
    return NextResponse.json({ 
      questions: questions || [],
      totalCount: totalCount,
      activeCount: activeCount
    });

  } catch (error: any) {
    console.error('[FEEDBACK:Q:PUBLIC] list exception:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
