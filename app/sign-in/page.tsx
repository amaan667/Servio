"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";
import { useAuth } from "@/app/auth/AuthProvider";
import SignInForm from "./signin-form";

function SignInPageContent() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for broken session (has refresh token but no access token)
    const checkForBrokenSession = async () => {
      const cookies = document.cookie.split(";");
      const hasRefreshToken = cookies.some((c) => c.trim().includes("auth-token-refresh"));
      const hasAccessToken = cookies.some(
        (c) => c.trim().includes("auth-token.0") || c.trim().includes("auth-token.1")
      );

      // If we have refresh but no access tokens, session is broken - clear it
      if (hasRefreshToken && !hasAccessToken) {
        console.log("[SIGN-IN] Detected broken session - clearing...");
        try {
          await supabaseBrowser().auth.signOut();
          // Clear all auth cookies
          cookies.forEach((cookie) => {
            const name = cookie.split("=")[0].trim();
            if (name.startsWith("sb-")) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
          });
          console.log("[SIGN-IN] Broken session cleared");
        } catch (e) {
          console.error("[SIGN-IN] Error clearing broken session:", e);
        }
      }
    };

    checkForBrokenSession();

    // Check for error and message parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    const messageParam = urlParams.get("message");
    const nextParam = urlParams.get("next");

    if (messageParam) {
      setError(messageParam);
    } else if (errorParam) {
      switch (errorParam) {
        case "pkce_error":
          setError(
            "Authentication failed due to security verification. Please try signing in again."
          );
          break;
        case "refresh_token_error":
          setError("Your session has expired. Please sign in again.");
          break;
        default:
          setError("Authentication failed. Please try again.");
      }
    }

    // If user is already signed in, redirect to their first venue or next URL
    if (session && !loading) {
      const fetchVenueAndRedirect = async () => {
        const supabase = supabaseBrowser();
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (nextParam) {
          router.push(nextParam);
        } else if (venues && venues.length > 0) {
          router.push(`/dashboard/${venues[0]?.venue_id}`);
        } else {
          router.push("/select-plan");
        }
      };

      fetchVenueAndRedirect();
    }
  }, [session, loading, router]);

  const signInWithGoogle = async () => {
    if (isSigningIn) {
      return;
    }

    try {
      setIsSigningIn(true);

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
        const msg = error?.message || "Sign in failed.";
        // If rate limited, display a friendlier message with longer wait time
        if (/rate limit/i.test(msg)) {
          alert("Too many sign-in attempts. Please wait 1 minute and try again.");
        } else if (/network|connection|timeout/i.test(msg)) {
          alert("Connection issue. Please check your internet and try again.");
        } else if (/invalid.*credentials/i.test(msg)) {
          alert("Invalid email or password. Please check and try again.");
        } else {
          alert(`Sign in failed: ${msg}`);
        }
        setIsSigningIn(false);
        return;
      }

      // The redirect should happen automatically, but if it doesn't, we'll handle it
      if (data.url) {
        // For both mobile and desktop, use window.location.href for full page redirect
        // This ensures proper OAuth flow on all devices
        window.location.href = data.url;
      }
    } catch {
      alert("Sign in failed. Please try again.");
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md mx-auto">
        <SignInForm
          onGoogleSignIn={signInWithGoogle}
          isLoading={isSigningIn}
          error={error}
          onClearError={() => setError(null)}
        />
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPageContent />
    </Suspense>
  );
}
