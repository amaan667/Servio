"use client";
import { supabase } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";

export function GoogleButton() {
  return (
    <button
      onClick={async () => {
        await supabase.auth.signInWithOAuth({

          options: { redirectTo: getAuthRedirectUrl("/auth/callback") },

      }}
      className="bg-white border border-gray-300 text-black hover:bg-gray-50 px-4 py-2 rounded-md font-medium"
    >
      Continue with Google
    </button>
  );
}
