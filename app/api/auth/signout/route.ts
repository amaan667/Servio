import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
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

    console.log('[AUTH DEBUG] Server-side sign out initiated');
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.log('[AUTH DEBUG] Server-side sign out failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Server-side sign out successful');
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.log('[AUTH DEBUG] Server-side sign out error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
