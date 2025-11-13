"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Callback handler for Supabase password reset verify endpoint
 * The verify endpoint redirects here with hash fragments containing the recovery tokens
 */
export default function ResetPasswordCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = supabaseBrowser();

        // Check for hash fragments in URL (Supabase redirects with hash fragments)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        console.log("[RESET PASSWORD CALLBACK] URL analysis:", {
          fullUrl: window.location.href,
          hash: window.location.hash,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
        });

        if (!accessToken || type !== "recovery") {
          setError("Invalid reset link. Missing recovery tokens.");
          setTimeout(() => router.push("/forgot-password"), 3000);
          return;
        }

        // Set the recovery session
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (sessionError || !sessionData.session) {
          console.error("[RESET PASSWORD CALLBACK] Failed to set session:", sessionError);
          setError(sessionError?.message || "Failed to establish recovery session");
          setTimeout(() => router.push("/forgot-password"), 3000);
          return;
        }

        logger.info("[RESET PASSWORD CALLBACK] ✅ Recovery session established", {
          userId: sessionData.session.user.id,
        });

        // Redirect to reset-password page (without hash fragments)
        // The session is now established, so the reset-password page will detect it
        router.replace("/reset-password");
      } catch (err) {
        console.error("[RESET PASSWORD CALLBACK] Error:", err);
        setError("An error occurred processing the reset link");
        setTimeout(() => router.push("/forgot-password"), 3000);
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Reset Link Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to forgot password page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing reset link...</p>
      </div>
    </div>
  );
}
