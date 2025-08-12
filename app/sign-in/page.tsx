export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import SignInForm from "./signin-form";

export default async function SignInPage() {
  console.log('[AUTH DEBUG] /sign-in server page start', {
    env_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    env_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });
  const cookieStore = cookies();
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

  const { data: { user } } = await supabase.auth.getUser();
  console.log('[AUTH DEBUG] /sign-in getUser result', { hasUser: Boolean(user), userId: user?.id });
  if (user) {
    console.log('[AUTH DEBUG] /sign-in redirecting to /dashboard');
    redirect("/dashboard");
  }

  return <SignInForm />;
}
