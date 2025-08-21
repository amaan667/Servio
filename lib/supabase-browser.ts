'use client';
import { createBrowserClient } from '@supabase/ssr';

// Create a browser client without throwing at module import time.
// Environment validation is handled in route handlers and calling sites.
export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
