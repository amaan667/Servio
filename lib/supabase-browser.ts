'use client';
import { createBrowserClient } from '@supabase/ssr';

const BASE = process.env.NEXT_PUBLIC_APP_URL!;
if (!BASE || BASE.includes('localhost')) {
  // Hard fail if someone tries to boot the app with localhost base
  throw new Error('NEXT_PUBLIC_APP_URL must be your production URL.');
}

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
