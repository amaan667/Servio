"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const supabase = createClientComponentClient();

export async function signInWithGoogle() {
  const redirectTo = 'https://servio-production.up.railway.app/auth/callback'; // <-- hardcode for now
  console.log('[AUTH] using redirectTo =', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
    flowType: 'pkce',
  });

  if (error) {
    console.error('[AUTH] start error:', error.message);
    alert(error.message);
    return;
  }
  if (data?.url) window.location.href = data.url; // force navigation
}

export async function signInUser(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { success: false, message: error?.message || "Failed to sign in" };
    }
    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, message: "An unexpected error occurred" };
  }
}