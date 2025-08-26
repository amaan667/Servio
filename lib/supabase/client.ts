"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Check if environment variables are available
  if (!url || !key) {
    console.error('Supabase environment variables are missing:', {
      hasUrl: !!url,
      hasKey: !!key,
      url: url || 'NOT SET',
      key: key ? 'SET' : 'NOT SET'
    });
    
    // Return a mock client that will fail gracefully
    return createBrowserClient('https://invalid.supabase.co', 'invalid-key', {
      isSingleton: true,
      cookies: { /* not used on browser */ },
    });
  }
  
  // Singleton ensures one instance across renders; persist session in browser
  return createBrowserClient(url, key, {
    isSingleton: true,
    cookies: { /* not used on browser */ },
  });
}
