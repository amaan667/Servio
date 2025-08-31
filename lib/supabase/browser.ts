import { createBrowserClient } from '@supabase/ssr';

let supabaseBrowserInstance: ReturnType<typeof createBrowserClient> | null = null;

export const supabaseBrowser = () => {
  if (typeof window === 'undefined') {
    throw new Error('supabaseBrowser can only be used in the browser');
  }
  
  if (!supabaseBrowserInstance) {
    supabaseBrowserInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false, // Disable session persistence to prevent auto sign-in
          autoRefreshToken: false, // Disable auto refresh to prevent auto sign-in
          detectSessionInUrl: false, // Disable session detection in URL
          flowType: 'pkce',
        },
      }
    );
  }
  
  return supabaseBrowserInstance;
};
