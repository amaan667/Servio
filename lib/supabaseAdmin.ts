import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialize Supabase admin client
let supabaseAdminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    
    supabaseAdminInstance = createClient(
      url,
      key, // bypasses RLS (needed for webhooks)
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return supabaseAdminInstance;
}

// Export for backward compatibility
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabaseAdmin()[prop as keyof SupabaseClient];
  }
});
