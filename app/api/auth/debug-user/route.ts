import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      return NextResponse.json({ 
        authenticated: false, 
        error: userError.message,
        timestamp: new Date().toISOString()
      });
    }
    
    if (!user) {
      return NextResponse.json({ 
        authenticated: false, 
        message: 'No authenticated user',
        timestamp: new Date().toISOString()
      });
    }
    
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
    return NextResponse.json({ 
      authenticated: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}