"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { logger } from "@/lib/logger";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams?.get("code");
        const errorParam = searchParams?.get("error");

        logger.info("[AUTH CALLBACK CLIENT] Starting callback", {
          hasCode: !!code,
          hasError: !!errorParam,
        });

        if (errorParam) {
          setError(`OAuth error: ${errorParam}`);
          return;
        }

        if (!code) {
          setError("No authorization code found");
          return;
        }

        // Get Supabase client - it will auto-detect session from URL with detectSessionInUrl: true
        const supabase = supabaseBrowser();

        // Give Supabase a moment to process the URL params automatically
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if session was auto-detected
        const {
          data: { session: autoSession },
        } = await supabase.auth.getSession();
        if (autoSession) {
          logger.info("[AUTH CALLBACK CLIENT] Session auto-detected", {
            userId: autoSession.user.id,
            email: autoSession.user.email,
          });

          // Session is already set - proceed to redirect
          const { data: venues } = await supabase
            .from("venues")
            .select("venue_id, created_at")
            .eq("owner_user_id", autoSession.user.id)
            .order("created_at", { ascending: true })
            .limit(1);

          if (venues && venues.length > 0) {
            router.push(`/dashboard/${venues[0].venue_id}`);
            return;
          }

          router.push("/select-plan");
          return;
        }

          "[AUTH CALLBACK CLIENT] ⚠️ Session NOT auto-detected, trying manual exchange..."
        );

        // Check if PKCE verifier exists before attempting exchange
        // Search for any Supabase code verifier in localStorage
        const allKeys = Object.keys(localStorage);
        const verifierKey = allKeys.find((key) => key.includes("code-verifier"));
        const verifierValue = verifierKey ? localStorage.getItem(verifierKey) : null;

        // Get ALL localStorage items for debugging
        const allStorageItems: Record<string, string> = {};
        allKeys.forEach((key) => {
          const value = localStorage.getItem(key);
          allStorageItems[key] = value ? `${value.substring(0, 30)}...` : "null";
        });

          hasVerifier: !!verifierValue,
          verifierKey,
          verifierLength: verifierValue?.length,
          verifierPreview: verifierValue?.substring(0, 20),
          verifierIsEmpty: verifierValue === "",
          allAuthKeys: allKeys.filter((k) => k.includes("sb-") || k.includes("supabase")),
          allKeyCount: allKeys.length,
        });

        logger.info("[AUTH CALLBACK CLIENT] PKCE verifier check:", {
          hasVerifier: !!verifierValue,
          verifierKey,
          verifierLength: verifierValue?.length,
          isEmpty: verifierValue === "",
        });

          "[AUTH CALLBACK CLIENT] 🚀 Calling exchangeCodeForSession with code:",
          code?.substring(0, 20)
        );

        // Try to explicitly use the verifier if found
        let exchangeOptions = {};
        if (verifierValue && verifierKey) {
            "[AUTH CALLBACK CLIENT] 📦 Attempting to use explicit verifier from localStorage"
          );
          // The Supabase client should automatically use the verifier from storage
          // but let's ensure it's available
        }

        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          hasData: !!data,
          hasSession: !!data?.session,
          hasError: !!exchangeError,
        });

        if (exchangeError) {
          console.error("[AUTH CALLBACK CLIENT] ❌ Exchange error:", {
            error: exchangeError,
            errorMessage: exchangeError.message,
            errorCode: exchangeError.code,
            errorStatus: exchangeError.status,
            hadVerifierInStorage: !!verifierValue,
            verifierLength: verifierValue?.length,
            verifierWasEmpty: verifierValue === "",
          });

          logger.error("[AUTH CALLBACK CLIENT] Exchange error:", {
            error: exchangeError,
            errorMessage: exchangeError.message,
            hadVerifier: !!verifierValue,
            verifierLength: verifierValue?.length,
          });

          // If verifier was missing or empty, give user a helpful error
          if (!verifierValue || verifierValue === "") {
            setError(
              `Authentication failed: PKCE verifier missing or empty. Please try signing in again.`
            );
          } else {
            setError(`Authentication failed: ${exchangeError.message}`);
          }
          return;
        }

        if (!data?.session) {
          setError("Failed to create session");
          return;
        }

        logger.info("[AUTH CALLBACK CLIENT] ✅ Session created in browser", {
          userId: data.session.user.id,
          email: data.session.user.email,
        });

        // Now call server endpoint to SET COOKIES from the session using setSession
        const response = await fetch("/api/auth/set-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          }),
          credentials: "include",
        });

          status: response.status,
          ok: response.ok,
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("[AUTH CALLBACK CLIENT] Sync failed:", errorData);
          logger.error("[AUTH CALLBACK CLIENT] Failed to sync session to server");
          setError("Failed to sync session. Please try again.");
          return;
        }

        const syncData = await response.json();

        // Verify cookies were set by making a test request
        const checkResponse = await fetch("/api/auth/check-cookies", {
          credentials: "include",
        });
        const cookieCheck = await checkResponse.json();

        // Check if user has a venue (get FIRST venue - oldest)
        const { data: venues, error: venuesError } = await supabase
          .from("venues")
          .select("venue_id, created_at")
          .eq("owner_user_id", data.session.user.id)
          .order("created_at", { ascending: true })
          .limit(5); // Get first 5 to debug

          venueCount: venues?.length,
          venues: venues?.map((v) => ({ id: v.venue_id, created: v.created_at })),
          firstVenue: venues?.[0]?.venue_id,
          allVenueIds: venues?.map((v) => v.venue_id),
          error: venuesError?.message,
        });

        if (venues && venues.length > 0 && venues[0]) {
          const targetVenue = venues[0].venue_id;
            venueId: targetVenue,
            createdAt: venues[0].created_at,
          });
          router.push(`/dashboard/${targetVenue}`);
          return;
        }

        // Check if staff member
        const { data: staffRoles } = await supabase
          .from("user_venue_roles")
          .select("venue_id")
          .eq("user_id", data.session.user.id)
          .limit(1);

          roleCount: staffRoles?.length,
          firstVenue: staffRoles?.[0]?.venue_id,
        });

        if (staffRoles && staffRoles.length > 0 && staffRoles[0]?.venue_id) {
            "[AUTH CALLBACK CLIENT] ✅ Redirecting to staff venue:",
            staffRoles[0].venue_id
          );
          router.push(`/dashboard/${staffRoles[0].venue_id}`);
          return;
        }

        // New user - redirect to select plan
        router.push("/select-plan");
      } catch (err) {
        logger.error("[AUTH CALLBACK CLIENT] Unexpected error:", { error: err });
        setError("An unexpected error occurred");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">Authentication Error</h1>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => router.push("/sign-in")}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
