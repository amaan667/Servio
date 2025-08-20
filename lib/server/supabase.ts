import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// [AUTH] Utility function to create server-side Supabase client with proper cookie handling
export function createServerSupabaseClient() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o, path: '/', secure: true, sameSite: 'lax' }),
        remove: (n, o) => jar.set({ name: n, value: '', ...o, path: '/', secure: true, sameSite: 'lax' }),
      },
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );
}
