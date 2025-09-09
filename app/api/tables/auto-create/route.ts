import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venue_id, table_number, table_label, seat_count = 4, area = null } = body;

    if (!venue_id || !table_number) {
      return NextResponse.json({ 
        success: false, 
        error: 'venue_id and table_number are required' 
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { },
          remove(name: string, options: any) { },
        },
      }
    );

    console.log('[AUTO CREATE TABLE] Creating table for QR scan:', { venue_id, table_number, table_label });

    // Use upsert to prevent duplicates - this will insert if not exists, or return existing if it does
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .upsert({
        venue_id: venue_id,
        label: table_label || table_number.toString(),
        seat_count: seat_count,
        area: area,
        is_active: true
      }, {
        onConflict: 'venue_id,label',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (tableError) {
      console.error('[AUTO CREATE TABLE] Table creation error:', tableError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create table' 
      }, { status: 500 });
    }

    console.log('[AUTO CREATE TABLE] Table created/updated successfully:', table.id);

    // Check if session already exists for this table
    const { data: existingSession } = await supabase
      .from('table_sessions')
      .select('id')
      .eq('table_id', table.id)
      .eq('venue_id', venue_id)
      .maybeSingle();

    // Only create session if one doesn't already exist
    if (!existingSession) {
      const { error: sessionError } = await supabase
        .from('table_sessions')
        .insert({
          venue_id: venue_id,
          table_id: table.id,
          status: 'FREE',
          opened_at: new Date().toISOString(),
          closed_at: null
        });

      if (sessionError) {
        console.error('[AUTO CREATE TABLE] Session creation error:', sessionError);
        // Don't fail the request if session creation fails, table is still created
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        table_id: table.id,
        table_label: table.label,
        was_created: true
      }
    });

  } catch (error) {
    console.error('[AUTO CREATE TABLE] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
