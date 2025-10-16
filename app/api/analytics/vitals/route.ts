import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const vitals = await req.json();
    
    // Log Core Web Vitals
    console.log('[Web Vitals]', {
      metric: vitals.name,
      value: vitals.value,
      rating: vitals.rating,
      id: vitals.id,
      navigationType: vitals.navigationType,
    });

    // Here you can send to your analytics service:
    // - Google Analytics 4
    // - Plausible
    // - Custom analytics endpoint
    // - Supabase table for tracking
    
    // Example: Store in database for monitoring
    // await supabase.from('web_vitals').insert({
    //   metric_name: vitals.name,
    //   metric_value: vitals.value,
    //   metric_rating: vitals.rating,
    //   metric_id: vitals.id,
    //   navigation_type: vitals.navigationType,
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Web Vitals] Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

