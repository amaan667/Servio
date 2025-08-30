import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      return NextResponse.json({ authenticated: false, error: userError.message });
    }
    
    return NextResponse.json({ 
      authenticated: !!user, 
      user: user ? { id: user.id, email: user.email } : null 
    });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, error: error.message });
  }
}
