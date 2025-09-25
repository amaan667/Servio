import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

export async function POST() {
  try {
    
    // Create Supabase admin client
    const supabase = await createAdminClient();

    
    // Read the SQL file
    const sqlPath = join(process.cwd(), 'fix-merge-functions.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { 
      sql: sqlContent 
    });
    
    if (error) {
      console.error('❌ Error applying fixed merge function:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    
    return NextResponse.json({
      success: true,
      message: 'Fixed merge function applied successfully',
      details: 'Function now uses valid table_status enum values (OCCUPIED instead of MERGED)'
    });
    
  } catch (error: any) {
    console.error('❌ Fatal error during setup:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
