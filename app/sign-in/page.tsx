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
      // BUT: Only if we're not in the middle of an OAuth flow
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthCallback = window.location.pathname.includes("/auth/callback");

      if (hasRefreshToken && !hasAccessToken && !isOAuthCallback) {
        try {
          // DON'T call signOut() - it clears PKCE verifier needed for OAuth!
          // Clear broken auth cookies AND localStorage items manually
          cookies.forEach((cookie) => {
            const name = (cookie.split("=")[0] ?? "").trim();
            // Clear auth cookies but PRESERVE code-verifier for OAuth
            if (name.startsWith("sb-") && !name.includes("code-verifier")) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
          });

          // Also clear localStorage auth items (except PKCE verifier)
          const allKeys = Object.keys(localStorage);
          allKeys.forEach((key) => {
            if (key.startsWith("sb-") && !key.includes("code-verifier")) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {
          /* Error handled silently */
        }
      } else if (hasRefreshToken && !hasAccessToken && isOAuthCallback) {
        // OAuth callback detected with refresh token
      }
    };

    checkForBrokenSession();

    // Check for error and message parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    const messageParam = urlParams.get("message");
    const nextParam = urlParams.get("next");
    const passwordResetParam = urlParams.get("passwordReset");

    if (passwordResetParam === "true") {
      // Show success message for password reset
      setError(null); // Clear any errors
      // We'll handle this in the SignInForm component
    } else if (messageParam) {
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
        try {
          const supabase = supabaseBrowser();
          const { data: venues, error } = await supabase
            .from("venues")
            .select("venue_id, created_at")
            .eq("owner_user_id", session.user.id)
            .order("created_at", { ascending: true }) // ✅ Get FIRST venue (oldest)
            .limit(5); // Get first 5 to debug

          // If query fails, don't redirect to select-plan - might be temporary error
          if (error) {
            // If there's a nextParam, still redirect there
            if (nextParam) {
              router.push(nextParam);
            }
            // Otherwise, stay on sign-in page (don't redirect to select-plan on error)
            return;
          }

          if (nextParam) {
            router.push(nextParam);
          } else if (venues && venues.length > 0) {
            router.push(`/dashboard/${venues[0]?.venue_id}`);
          } else {
            // Check if user has pending signup data (incomplete signup flow)
            const pendingSignup = session.user.user_metadata?.pending_signup;
            if (pendingSignup) {
              // User has pending signup but no venues - redirect to onboarding
              router.push("/onboarding/venue-setup");
            } else {
              // No venues and no pending signup - redirect to home page
              // User can then click "Start Free Trial" to go to plan selection
              router.push("/");
            }
          }
        } catch (error) {
          // On exception, don't redirect - stay on sign-in page
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

      // Clear all dashboard caches before signing in to prevent stale data
      if (typeof window !== "undefined") {
        Object.keys(sessionStorage).forEach((key) => {
          if (
            key.startsWith("dashboard_user_") ||
            key.startsWith("dashboard_venue_") ||
            key.startsWith("user_role_") ||
            key.startsWith("venue_id_")
          ) {
            sessionStorage.removeItem(key);
          }
        });
      }

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

      // Log localStorage after OAuth initiation
      const allKeys = Object.keys(localStorage);
      const verifierKeys = allKeys.filter((k) => k.includes("verifier") || k.includes("code"));

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
