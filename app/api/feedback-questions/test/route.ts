import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const serviceClient = getServiceClient();
    
    // Test if the table exists
    const { data, error } = await serviceClient
      .from('feedback_questions')
      .select('count')
      .limit(1);

    if (error) {
      console.error('[FEEDBACK] Test error:', error);
      return NextResponse.json({ 
        error: 'Table not found or access denied',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Table exists and is accessible',
      count: data?.length || 0
    });

  } catch (error: any) {
    console.error('[FEEDBACK] Test exception:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: error.message 
    }, { status: 500 });
  }
}
