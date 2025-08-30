import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    
    console.log('[AUTH DEBUG] Clearing auth state');
    
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.log('[AUTH DEBUG] Sign out error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      });
    }

    console.log('[AUTH DEBUG] Auth state cleared successfully');
    return NextResponse.json({ 
      success: true, 
      message: 'Auth state cleared' 
    });
  } catch (err: any) {
    console.log('[AUTH DEBUG] Clear auth error:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    });
  }
}
