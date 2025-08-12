"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const supabase = createClientComponentClient();

export async function signInWithGoogle() {
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) console.error("[AUTH] Google sign-in error:", error.message);
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