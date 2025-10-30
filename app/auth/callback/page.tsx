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

        // Exchange code for session ON CLIENT (has access to localStorage PKCE verifier)
        const supabase = supabaseBrowser();
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          logger.error("[AUTH CALLBACK CLIENT] Exchange error:", { error: exchangeError });
          setError(`Authentication failed: ${exchangeError.message}`);
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

        // Now call server endpoint to SET COOKIES from the session
        const response = await fetch("/api/auth/sync-session", {
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

        if (!response.ok) {
          logger.error("[AUTH CALLBACK CLIENT] Failed to sync session to server");
          setError("Failed to sync session. Please try again.");
          return;
        }

        logger.info("[AUTH CALLBACK CLIENT] ✅ Session synced to server cookies");

        // Check if user has a venue
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_user_id", data.session.user.id)
          .order("created_at", { ascending: true })
          .limit(1);

        if (venues && venues.length > 0 && venues[0]) {
          router.push(`/dashboard/${venues[0].venue_id}`);
          return;
        }

        // Check if staff member
        const { data: staffRoles } = await supabase
          .from("user_venue_roles")
          .select("venue_id")
          .eq("user_id", data.session.user.id)
          .limit(1);

        if (staffRoles && staffRoles.length > 0 && staffRoles[0]?.venue_id) {
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
