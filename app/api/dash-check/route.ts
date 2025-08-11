import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  try {
    const cookieStore = cookies(); // no await
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: (name, value, options) => cookieStore.set({ name, value, ...options }),
          remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
        },
      }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !user) {
      return NextResponse.json({
        success: false,
        error: 'No user found',
        userError: userErr?.message,
      });
    }

    // Test venues query
    const { data: venues, error: venuesErr } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      venues: venues || [],
      venuesError: venuesErr?.message || null,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Server error',
      details: error.message,
    });
  }
}
