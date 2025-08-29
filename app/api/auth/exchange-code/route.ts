import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();
    
    if (!code) {
      console.log('[AUTH DEBUG] No code provided to exchange');
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    console.log('[AUTH DEBUG] Exchanging code for session on server side');
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.log('[AUTH DEBUG] Server-side exchange failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Server-side exchange successful');
    
    return NextResponse.json({ 
      success: true, 
      user: data.user,
      session: data.session 
    });
    
  } catch (error: any) {
    console.log('[AUTH DEBUG] Server-side exchange error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
