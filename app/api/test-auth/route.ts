import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('[AUTH DEBUG] Test auth - User error:', userError.message);
      return NextResponse.json({ 
        authenticated: false, 
        error: userError.message,
        timestamp: new Date().toISOString()
      });
    }
    
    if (!user) {
      console.log('[AUTH DEBUG] Test auth - No user found');
      return NextResponse.json({ 
        authenticated: false, 
        message: 'No authenticated user',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('[AUTH DEBUG] Test auth - User authenticated:', user.email);
    return NextResponse.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.log('[AUTH DEBUG] Test auth - Exception:', error.message);
    return NextResponse.json({ 
      authenticated: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}