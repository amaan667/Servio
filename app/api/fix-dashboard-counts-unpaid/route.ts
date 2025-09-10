import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    // Test the current function first
    const { data: testResult, error: testError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: 'venue-1e02af4d', 
        p_tz: 'Europe/London', 
        p_live_window_mins: 30 
      })
      .single();

    if (testError) {
      console.error('Error testing dashboard_counts function:', testError);
      return NextResponse.json({ ok: false, error: `Function test failed: ${testError.message}` }, { status: 500 });
    }

    console.log('Current dashboard_counts result:', testResult);

    return NextResponse.json({ 
      ok: true, 
      message: 'Dashboard counts function test successful',
      currentCounts: testResult
    });

  } catch (error: any) {
    console.error('Error in fix-dashboard-counts-unpaid:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}