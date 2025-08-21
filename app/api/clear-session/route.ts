import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    
    // Sign out the user - this will handle cookie clearing automatically
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[CLEAR SESSION] Error signing out:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      });
    }
    
    console.log('[CLEAR SESSION] Session cleared successfully');
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('[CLEAR SESSION] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error occurred' 
    });
  }
}
