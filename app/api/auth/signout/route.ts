import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  try {
    console.log('[SIGNOUT API] Starting signout process');
    
    const supabase = await createServerSupabase();
    
    // Check if there's an existing session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('[SIGNOUT API] Error getting session:', sessionError.message);
    }
    
    if (!session) {
      console.log('[SIGNOUT API] No session found, signout successful');
      return NextResponse.json({ ok: true, message: 'No session to sign out' });
    }
    
    console.log('[SIGNOUT API] Session found, signing out user:', session.user.id);
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.log('[SIGNOUT API] Signout error:', error.message);
      return NextResponse.json({ ok: false, error: error.message });
    }
    
    console.log('[SIGNOUT API] Signout successful');
    return NextResponse.json({ ok: true, message: 'Signout successful' });
  } catch (error: any) {
    console.log('[SIGNOUT API] Unexpected error:', error.message);
    return NextResponse.json({ ok: false, error: error.message });
  }
}
