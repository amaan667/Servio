'use client';
import { createBrowserClient } from '@supabase/ssr';

console.log('[AUTH DEBUG] ===== Supabase Browser Client Creation =====');
console.log('[AUTH DEBUG] Browser environment:', {
  hasWindow: typeof window !== 'undefined',
  hasLocalStorage: typeof window !== 'undefined' ? !!window.localStorage : false,
  userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
  timestamp: new Date().toISOString()
});

// Create a browser client with PKCE support and session persistence
export const supabaseBrowser = () => {
  console.log('[AUTH DEBUG] Creating new Supabase browser client instance');
  
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'supabase.auth.token',
      },
    }
  );
  
  console.log('[AUTH DEBUG] Supabase browser client created with config:', {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    hasStorage: typeof window !== 'undefined' ? !!window.localStorage : false,
    storageKey: 'supabase.auth.token'
  });
  
  return client;
};
