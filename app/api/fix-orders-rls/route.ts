import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    
    const supabase = createAdminClient();
    
    // Check current RLS status
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('check_rls_status', { table_name: 'orders' });
    
    
    if (rlsError) {
    }
    
    // Try to disable RLS on orders table (this should work with service role)
    const { data: disableResult, error: disableError } = await supabase
      .rpc('exec_sql', { 
        sql: 'ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;' 
      });
    
    if (disableError) {
      // Try alternative approach - create a permissive policy
      const { data: policyResult, error: policyError } = await supabase
        .rpc('exec_sql', { 
          sql: `
            DROP POLICY IF EXISTS "allow_all_orders" ON public.orders;
            CREATE POLICY "allow_all_orders" ON public.orders
            FOR ALL USING (true);
          ` 
        });
      
      if (policyError) {
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to fix RLS policies',
          details: { disableError, policyError }
        }, { status: 500 });
      }
      
    } else {
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'RLS policies fixed for orders table',
      rlsStatus,
      disableResult,
      policyResult: disableError ? 'Created permissive policy' : 'Disabled RLS'
    });
    
  } catch (error: any) {
    console.error('[FIX ORDERS RLS] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
