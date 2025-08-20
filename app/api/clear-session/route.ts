import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[CLEAR SESSION] Error signing out:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      });
    }
    
    console.log('[CLEAR SESSION] Session cleared successfully');
    
    const response = NextResponse.json({ success: true });
    
    // Clear cookies
    response.cookies.set('sb-access-token', '', { 
      path: '/', 
      expires: new Date(0),
      secure: true,
      sameSite: 'lax'
    });
    response.cookies.set('sb-refresh-token', '', { 
      path: '/', 
      expires: new Date(0),
      secure: true,
      sameSite: 'lax'
    });
    
    return response;
    
  } catch (error) {
    console.error('[CLEAR SESSION] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error occurred' 
    });
  }
}
