export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import SignInForm from "./signin-form";

export default async function SignInPage({ 
  searchParams 
}: { 
  searchParams?: { signedOut?: string; error?: string } 
}) {
  console.log('[AUTH DEBUG] /sign-in server page start', {
    env_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    env_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });
  
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        // No-ops here to keep this page read-only for cookies
        set: () => {},
        remove: () => {},
      },
    }
  );

  const signedOut = searchParams?.signedOut === 'true';
  const error = searchParams?.error;
  
  // If signedOut=true, bypass any auto-login and always show sign-in form
  if (signedOut) {
    console.log('[AUTH DEBUG] /sign-in signedOut=true, bypassing auto-login');
    // Force clear any remaining session cookies
    const authCookies = [
      'sb-access-token', 
      'sb-refresh-token', 
      'supabase-auth-token',
      'supabase-auth-code-verifier'
    ];
    authCookies.forEach(cookieName => {
      cookieStore.set({ 
        name: cookieName, 
        value: '', 
        path: '/', 
        secure: true, 
        sameSite: 'lax',
        maxAge: 0,
        expires: new Date(0)
      });
    });
  } else {
    // Only check for existing user if not coming from sign-out
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[AUTH DEBUG] /sign-in getUser result', { hasUser: Boolean(user), userId: user?.id });
    
    if (user) {
      console.log('[AUTH DEBUG] /sign-in redirecting to /dashboard');
      redirect("/dashboard");
    }
  }

  // If there's an error, we should still show the sign-in form
  if (error) {
    console.log('[AUTH DEBUG] /sign-in error detected', { error });
  }

  return <SignInForm />;
}
