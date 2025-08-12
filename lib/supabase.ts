"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const supabase = createClientComponentClient();

export async function signInWithGoogle() {
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  console.log('[AUTH DEBUG] signInWithGoogle start', {
    redirectTo,
    env_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    env_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });

  if (error) {
    console.error('[AUTH DEBUG] signInWithGoogle error', { message: error.message });
    return;
  }
  if (data?.url) {
    console.log('[AUTH DEBUG] signInWithGoogle redirecting browser to Google URL', { url: data.url });
    window.location.href = data.url; // force navigation
  } else {
    console.log('[AUTH DEBUG] signInWithGoogle no redirect URL returned');
  }
}

export async function signInUser(email: string, password: string) {
  try {
    console.log('[AUTH DEBUG] signInUser start', { email });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      console.log('[AUTH DEBUG] signInUser failed', { message: error?.message });
      return { success: false, message: error?.message || "Failed to sign in" };
    }
    console.log('[AUTH DEBUG] signInUser success', { userId: data.user.id });
    return { success: true, user: data.user };
  } catch (error: any) {
    console.log('[AUTH DEBUG] signInUser unexpected error', { message: error?.message });
    return { success: false, message: "An unexpected error occurred" };
  }
}