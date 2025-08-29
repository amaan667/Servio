"use client";
import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { 
        isSingleton: true,
        // Disable cookie operations on client side to prevent Next.js 15 errors
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {}
        }
      }
    );
  }
  return _client;
}
