import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  
  const supabase = await createClient();

  try {
    // Read the SQL file
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(process.cwd(), 'fix-dashboard-timezone.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('Error executing SQL:', error);
      return NextResponse.json({ 
        ok: false, 
        error: error.message,
        details: error 
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Dashboard timezone fix applied successfully',
      data: data
    });

  } catch (error: any) {
    console.error('Error applying timezone fix:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      stack: error.stack 
    });
  }
}
