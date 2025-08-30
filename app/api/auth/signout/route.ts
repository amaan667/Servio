import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
