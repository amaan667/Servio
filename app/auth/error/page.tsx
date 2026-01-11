"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams?.get("reason");

  const getErrorMessage = (reason: string | null) => {
    switch (reason) {
      case "missing_code":
        return "No authorization code received from Google. Please try signing in again.";
      case "session_verification_failed":
        return "Failed to verify your session. Please try signing in again.";
      case "no_session_after_exchange":
        return "Authentication completed but no session was created. Please try again.";
      case "unexpected_error":
        return "An unexpected error occurred during authentication. Please try again.";
      default:
        return reason || "An error occurred during authentication. Please try again.";
    }
  };

  const handleRetry = () => {
    // Clear unknown stale auth state BUT preserve PKCE verifier
    if (typeof window !== "undefined") {
      Object.keys(localStorage).forEach((k) => {
        if ((k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("pkce")) {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.removeItem("sb_oauth_retry");
      sessionStorage.removeItem("sb_oauth_in_progress");
    }

    // Redirect back to sign-in
    window.location.href = "/sign-in";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600">Authentication Error</CardTitle>
          <CardDescription>We encountered an issue during sign-in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{getErrorMessage(reason || null)}</AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button onClick={handleRetry} className="w-full" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
          </div>

          <div className="text-center text-sm text-gray-900">
            <p>If this problem persists, please contact support.</p>
            {reason && <p className="mt-2 text-xs text-gray-900">Error code: {reason}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
