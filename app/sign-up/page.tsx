"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import SignUpForm from "./signup-form";

export default function SignUpPage() {
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);

  const signUpWithGoogle = async () => {
    if (isSigningUp) {
      return;
    }

    try {
      setIsSigningUp(true);

      // Use stable redirect URL helper
      const redirectTo = getAuthRedirectUrl("/auth/callback");

      const { data, error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
          },
          // PKCE is enabled by default in Supabase v2
        },
      });

      if (error) {
        toast({ title: "Error", description: `Sign up failed: ${error.message}`, variant: "destructive" });
        setIsSigningUp(false);
        return;
      }

      // The redirect should happen automatically, but if it doesn't, we'll handle it
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (_error) {
      toast({ title: "Error", description: "Sign up failed. Please try again.", variant: "destructive" });
      setIsSigningUp(false);
    }
  };

  return <SignUpForm onGoogleSignIn={signUpWithGoogle} isSigningUp={isSigningUp} />;
}
