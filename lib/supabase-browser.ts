'use client';
import { createBrowserClient } from '@supabase/ssr';

const PROD_BASE = 'https://servio-production.up.railway.app';
const BASE = process.env.NEXT_PUBLIC_APP_URL!;
const APP_URL = process.env.APP_URL || BASE;

if (!BASE || BASE.includes('localhost') || BASE !== PROD_BASE) {
  throw new Error('NEXT_PUBLIC_APP_URL must be set to https://servio-production.up.railway.app');
}

if (!APP_URL || APP_URL.includes('localhost') || APP_URL !== PROD_BASE) {
  throw new Error('APP_URL must be set to https://servio-production.up.railway.app');
}

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
