"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import { supabaseBrowser } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Log page load
    console.log("[RESET PASSWORD PAGE] ════════════════════════════════════════");
    console.log("[RESET PASSWORD PAGE] Page loaded:", {
      timestamp: new Date().toISOString(),
      fullUrl: window.location.href,
      hash: window.location.hash,
      search: window.location.search,
      pathname: window.location.pathname,
      origin: window.location.origin,
      referrer: document.referrer,
      userAgent: navigator.userAgent.substring(0, 100),
    });
    console.log("[RESET PASSWORD PAGE] ════════════════════════════════════════");

    // Check if we have a valid recovery session from Supabase
    const checkSession = async () => {
      const supabase = supabaseBrowser();
      let sessionEstablished = false;

      // Set up auth state change listener - Supabase fires PASSWORD_RECOVERY when processing hash fragments
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[RESET PASSWORD] Auth state change:", { event, hasSession: !!session });

        if (event === "PASSWORD_RECOVERY" && session) {
          console.log("[RESET PASSWORD] ✅ PASSWORD_RECOVERY event fired");
          sessionEstablished = true;
          setHasValidSession(true);
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      });

      // Check if we're on the verify endpoint (shouldn't happen, but handle it)
      const isVerifyEndpoint = window.location.href.includes("/auth/v1/verify");
      if (isVerifyEndpoint) {
        console.log("[RESET PASSWORD] ⚠️ Still on verify endpoint, waiting for redirect...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Check multiple times - Supabase verify endpoint redirect might happen after page load
      // The verify endpoint redirects with hash fragments, but they might appear with a delay
      let attempts = 0;
      const maxAttempts = 15; // 15 attempts * 500ms = 7.5 seconds total (longer for slow redirects)
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let type: string | null = null;

      console.log("[RESET PASSWORD] ════════════════════════════════════════");
      console.log("[RESET PASSWORD] Starting session check:", {
        initialUrl: window.location.href,
        initialHash: window.location.hash,
        initialSearch: window.location.search,
        referrer: document.referrer,
        hashLength: window.location.hash.length,
        searchLength: window.location.search.length,
        isVerifyEndpoint: window.location.href.includes("/auth/v1/verify"),
        timestamp: new Date().toISOString(),
      });
      console.log("[RESET PASSWORD] ════════════════════════════════════════");

      while (attempts < maxAttempts && !sessionEstablished) {
        // Check for hash fragments AND query parameters in URL
        // Supabase might use either depending on configuration
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);

        const currentAccessToken =
          hashParams.get("access_token") || queryParams.get("access_token");
        const currentRefreshToken =
          hashParams.get("refresh_token") || queryParams.get("refresh_token");
        const currentType = hashParams.get("type") || queryParams.get("type");

        console.log(`[RESET PASSWORD] Attempt ${attempts + 1}/${maxAttempts}:`, {
          hash: window.location.hash.substring(0, 150),
          search: window.location.search.substring(0, 150),
          hasAccessToken: !!currentAccessToken,
          type: currentType,
          fullUrl: window.location.href.substring(0, 250),
          pathname: window.location.pathname,
        });

        // Update tokens if found
        if (currentAccessToken && !accessToken) {
          accessToken = currentAccessToken;
          refreshToken = currentRefreshToken;
          type = currentType;
          console.log("[RESET PASSWORD] ✅ Tokens detected!");
        }

        // If we have tokens, set the session
        if (accessToken && type === "recovery") {
          try {
            console.log("[RESET PASSWORD] Setting session from tokens...");
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

            console.log("[RESET PASSWORD] Set session result:", {
              hasSession: !!sessionData.session,
              hasError: !!sessionError,
              errorMessage: sessionError?.message,
            });

            if (sessionData.session && !sessionError) {
              console.log("[RESET PASSWORD] ✅ Session established from tokens");
              sessionEstablished = true;
              setHasValidSession(true);
              window.history.replaceState(null, "", window.location.pathname);
              authListener?.subscription.unsubscribe();
              return;
            } else {
              console.error("[RESET PASSWORD] Failed to set session:", sessionError);
              // If token is invalid/expired, show error immediately
              if (
                sessionError?.message?.includes("expired") ||
                sessionError?.message?.includes("invalid")
              ) {
                setHasValidSession(false);
                setError(
                  sessionError.message || "Invalid or expired reset link. Please request a new one."
                );
                authListener?.subscription.unsubscribe();
                return;
              }
              // Otherwise continue checking in case it's a timing issue
            }
          } catch (err) {
            console.error("[RESET PASSWORD] Exception:", err);
            // Continue checking
          }
        }

        // Check if session was established via auto-detection
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (session && !sessionError) {
          console.log("[RESET PASSWORD] ✅ Session found via getSession");
          sessionEstablished = true;
          setHasValidSession(true);
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
          authListener?.subscription.unsubscribe();
          return;
        }

        // Wait before next check
        if (!sessionEstablished) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        attempts++;
      }

      // Final check
      if (!sessionEstablished) {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (session && !sessionError) {
          console.log("[RESET PASSWORD] ✅ Session found in final check");
          setHasValidSession(true);
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } else {
          console.log("[RESET PASSWORD] ❌ No session found after all attempts");
          setHasValidSession(false);

          if (!accessToken && !window.location.hash) {
            setError(
              "No reset token found. Please ensure you clicked the link directly from your email. The link may have expired or been used already."
            );
          } else if (sessionError) {
            setError(`Reset link error: ${sessionError.message}`);
          } else {
            setError("Invalid or expired reset link. Please request a new password reset link.");
          }
        }
      }

      authListener?.subscription.unsubscribe();
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!password.trim()) {
      setError("Password is required");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!hasValidSession) {
      setError("Invalid or expired reset link. Please request a new password reset link.");
      setLoading(false);
      return;
    }

    try {
      const supabase = supabaseBrowser();

      // Update password using Supabase auth
      // The user is already authenticated via the recovery session
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        setError(updateError.message || "Failed to reset password. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Sign out the recovery session
      await supabase.auth.signOut();

      // Redirect to sign-in after 3 seconds
      setTimeout(() => {
        router.push("/sign-in?passwordReset=true");
      }, 3000);
    } catch (_err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (hasValidSession === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <NavigationBreadcrumb showBackButton={false} />
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Password reset successfully!</strong>
                  <br />
                  Your password has been updated. You will be redirected to sign in shortly.
                </AlertDescription>
              </Alert>
              <Button onClick={() => router.push("/sign-in")} className="w-full">
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  disabled={loading}
                  required
                  autoFocus
                  minLength={6}
                />
                <p className="text-xs text-gray-500">Password must be at least 6 characters long</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  disabled={loading}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" disabled={loading || !hasValidSession} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-servio-purple hover:opacity-80 font-medium"
                >
                  Request a new reset link
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
