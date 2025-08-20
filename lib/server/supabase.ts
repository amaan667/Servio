import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Proper cookie adapter for PKCE flow
function cookieAdapter(jar: ReturnType<typeof cookies>) {
  return {
    get: (name: string) => jar.get(name)?.value,
    set: (name: string, value: string, options: any) =>
      jar.set(name, value, {
        ...options,
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      }),
    remove: (name: string, options: any) =>
      jar.set(name, '', {
        ...options,
        httpOnly: true,
        maxAge: 0,
        sameSite: 'lax',
        secure: true,
      }),
  };
}

// [AUTH] Utility function to create server-side Supabase client with proper cookie handling
export function createServerSupabaseClient() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter(jar) }
  );
}

// Export the cookie adapter for use in other server components
export { cookieAdapter };
