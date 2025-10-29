"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Import supabase browser directly to avoid lazy loading issues
import { supabaseBrowser, clearSupabaseAuth } from "@/lib/supabase";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  // Detect if we're on mobile
  const isMobile = () => {
    if (typeof window === "undefined") return false;
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      "android",
      "webos",
      "iphone",
      "ipad",
      "ipod",
      "blackberry",
      "iemobile",
      "opera mini",
      "mobile",
      "tablet",
    ];
    return (
      mobileKeywords.some((keyword) => userAgent.includes(keyword)) || window.innerWidth <= 768
    );
  };

  // Clear auth state function
  const clearAuthState = async () => {
    try {
      await clearSupabaseAuth();
    } catch {
      // Silent error handling
    }
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from URL parameters
        const code = searchParams?.get("code");
        const error = searchParams?.get("error");
        const state = searchParams?.get("state");

        if (error) {
          setError(`OAuth error: ${error}`);
          setLoading(false);
          return;
        }

        // Handle the case where we have state but no code (OAuth state mismatch)
        if (state && !code) {
          await clearAuthState();
          setError("OAuth state mismatch. Please try signing in again.");
          setLoading(false);
          return;
        }

        if (!code) {
          setError("No authorization code found in URL parameters");
          setLoading(false);
          return;
        }

        // Check if we have a valid session already
        const {
          data: { session: existingSession },
          error: sessionError,
        } = await supabaseBrowser().auth.getSession();

        if (existingSession) {
          // Fetch primary venue to redirect to venue-specific dashboard
          const { data: venues, error: venueError } = await supabaseBrowser()
            .from("venues")
            .select("venue_id")
            .eq("owner_user_id", existingSession.user.id)
            .order("created_at", { ascending: true })
            .limit(1);

          if (venueError || !venues || venues.length === 0) {
            // New user without venue - store email and redirect to plan selection
            setRedirecting(true);
            if (existingSession.user.email) {
              sessionStorage.setItem("pending_signup_email", existingSession.user.email);
            }
            await supabaseBrowser().auth.signOut();
            // Use replace to avoid back button issues
            router.replace("/select-plan");
            return;
          }

          const primaryVenue = venues[0];
          if (!primaryVenue) {
            // New user without venue - store email and redirect to plan selection
            setRedirecting(true);
            if (existingSession.user.email) {
              sessionStorage.setItem("pending_signup_email", existingSession.user.email);
            }
            await supabaseBrowser().auth.signOut();
            // Use replace to avoid back button issues
            router.replace("/select-plan");
            return;
          }

          router.push(`/dashboard/${primaryVenue.venue_id}`);
          return;
        }

        // Exchange the code for a session
        const { data, error: exchangeError } =
          await supabaseBrowser().auth.exchangeCodeForSession(code);

        if (exchangeError) {
          // Handle specific PKCE errors
          if (
            exchangeError.message?.includes("pkce") ||
            exchangeError.message?.includes("verifier") ||
            exchangeError.message?.includes("code verifier") ||
            exchangeError.code === "validation_failed"
          ) {
            await clearAuthState();
            setError("Authentication failed due to security verification. Please try again.");
            setLoading(false);
            return;
          }

          // Handle refresh token errors
          if (
            exchangeError.code === "refresh_token_not_found" ||
            exchangeError.message?.includes("refresh token")
          ) {
            await clearAuthState();
            setError("Your session has expired. Please try again.");
            setLoading(false);
            return;
          }

          // Handle network errors
          if (
            exchangeError.message?.includes("network") ||
            exchangeError.message?.includes("fetch") ||
            exchangeError.message?.includes("timeout")
          ) {
            setError("Network error. Please check your connection and try again.");
            setLoading(false);
            return;
          }

          // If it's not a specific error, try a fallback approach
          try {
            // Clear existing auth state
            await clearAuthState();

            // Try the exchange again
            const { data: retryData, error: retryError } =
              await supabaseBrowser().auth.exchangeCodeForSession(code);

            if (retryError) {
              setError(`Authentication failed: ${retryError.message}`);
              setLoading(false);
              return;
            }

            if (retryData?.session) {
              // Fetch primary venue to redirect to venue-specific dashboard
              const { data: venues, error: venueError } = await supabaseBrowser()
                .from("venues")
                .select("venue_id")
                .eq("owner_user_id", retryData.session.user.id)
                .order("created_at", { ascending: true })
                .limit(1);

              if (venueError || !venues || venues.length === 0) {
                // New user without venue - store email and sign them out
                setRedirecting(true);
                if (retryData.session.user.email) {
                  sessionStorage.setItem("pending_signup_email", retryData.session.user.email);
                }
                await supabaseBrowser().auth.signOut();
                router.replace("/select-plan");
                return;
              }

              const primaryVenue = venues[0];
              if (!primaryVenue) {
                // New user without venue - store email and sign them out
                setRedirecting(true);
                if (retryData.session.user.email) {
                  sessionStorage.setItem("pending_signup_email", retryData.session.user.email);
                }
                await supabaseBrowser().auth.signOut();
                router.replace("/select-plan");
                return;
              }

              router.push(`/dashboard/${primaryVenue.venue_id}`);
              return;
            }
          } catch (fallbackErr: unknown) {
            const fallbackError = fallbackErr as Error;
            setError(`Authentication failed: ${fallbackError.message}`);
            setLoading(false);
            return;
          }

          setError(`Exchange failed: ${exchangeError.message}`);
          setLoading(false);
          return;
        }

        if (data?.session) {
          // Fetch primary venue to redirect to venue-specific dashboard
          const { data: venues, error: venueError } = await supabaseBrowser()
            .from("venues")
            .select("venue_id")
            .eq("owner_user_id", data.session.user.id)
            .order("created_at", { ascending: true })
            .limit(1);

          if (venueError || !venues || venues.length === 0) {
            // New user without venue - store email and sign them out
            // They should NOT be authenticated until signup is complete
            setRedirecting(true);
            if (data.session.user.email) {
              sessionStorage.setItem("pending_signup_email", data.session.user.email);
            }
            await supabaseBrowser().auth.signOut();
            router.replace("/select-plan");
            return;
          }

          const primaryVenue = venues[0];
          if (!primaryVenue) {
            // New user without venue - store email and sign them out
            setRedirecting(true);
            if (data.session.user.email) {
              sessionStorage.setItem("pending_signup_email", data.session.user.email);
            }
            await supabaseBrowser().auth.signOut();
            router.replace("/select-plan");
            return;
          }

          router.push(`/dashboard/${primaryVenue.venue_id}`);
        } else {
          setError("Failed to create session - no session data returned");
          setLoading(false);
        }
      } catch (err: unknown) {
        const error = err as Error;

        // Handle timeout errors
        if (error.message?.includes("timeout")) {
          setError("Authentication timed out. Please try signing in again.");
          setLoading(false);
          return;
        }

        setError(error.message || "An unexpected error occurred during authentication");
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  // Remove blocking loading state - render content immediately
  // Auth state will be handled by the auth provider

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">Authentication Error</h1>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If redirecting to sign-up, show nothing to prevent flicker
  if (redirecting) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackContent />
    </Suspense>
  );
}
