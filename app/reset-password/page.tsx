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
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initPasswordReset = async () => {
      try {
        console.error("[RESET PASSWORD] ════════════════════════════════════════");
        console.error("[RESET PASSWORD] Page loaded:", {
          fullUrl: window.location.href,
          hash: window.location.hash,
          search: window.location.search,
          pathname: window.location.pathname,
        });
        console.error("[RESET PASSWORD] ════════════════════════════════════════");

        // Check for error in URL from Supabase
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorParam = params.get("error") || hashParams.get("error");
        const errorDescription =
          params.get("error_description") || hashParams.get("error_description");

        if (errorParam && mounted) {
          console.error("[RESET PASSWORD] ❌ Error in URL:", errorParam);
          setCheckingSession(false);
          setHasValidSession(false);
          setError(
            errorDescription || "Reset link is invalid or expired. Please request a new one."
          );
          return;
        }

        // Check for PKCE code in query params (newer Supabase flow)
        const code = params.get("code");
        if (code) {
          console.error("[RESET PASSWORD] 🔄 PKCE code detected, exchanging...");
          try {
            const { data: exchangeData, error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code);

            if (exchangeData.session && !exchangeError) {
              console.error("[RESET PASSWORD] ✅ Session established from PKCE code");
              setHasValidSession(true);
              setCheckingSession(false);
              window.history.replaceState(null, "", window.location.pathname);
              return;
            } else {
              console.error("[RESET PASSWORD] ❌ Code exchange failed:", exchangeError);
              setHasValidSession(false);
              setCheckingSession(false);
              setError(
                exchangeError?.message || "Invalid or expired reset link. Please request a new one."
              );
              return;
            }
          } catch (err) {
            console.error("[RESET PASSWORD] Exception during code exchange:", err);
            setHasValidSession(false);
            setCheckingSession(false);
            setError("Failed to process reset link. Please try again.");
            return;
          }
        }

        // Check for hash fragment tokens (older flow)
        const hashAccessToken = hashParams.get("access_token");
        const hashRefreshToken = hashParams.get("refresh_token");
        const hashType = hashParams.get("type");

        if (hashAccessToken && hashType === "recovery") {
          console.error("[RESET PASSWORD] 🔄 Hash tokens detected, setting session...");
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken || "",
            });

            if (sessionData.session && !sessionError) {
              console.error("[RESET PASSWORD] ✅ Session established from hash tokens");
              setHasValidSession(true);
              setCheckingSession(false);
              window.history.replaceState(null, "", window.location.pathname);
              return;
            } else {
              console.error("[RESET PASSWORD] ❌ Failed to set session:", sessionError);
              setHasValidSession(false);
              setCheckingSession(false);
              setError(
                sessionError?.message || "Invalid or expired reset link. Please request a new one."
              );
              return;
            }
          } catch (err) {
            console.error("[RESET PASSWORD] Exception:", err);
            setHasValidSession(false);
            setCheckingSession(false);
            setError("Failed to process reset link. Please try again.");
            return;
          }
        }

        // Listen for PASSWORD_RECOVERY event from Supabase
        // This fires automatically when Supabase processes the reset token
        const { data: authData } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;

          console.error("[RESET PASSWORD] Auth state change:", { event, hasSession: !!session });

          if (event === "PASSWORD_RECOVERY" && session) {
            console.error("[RESET PASSWORD] ✅ PASSWORD_RECOVERY event fired");
            setHasValidSession(true);
            setCheckingSession(false);
            setError(null);
            // Clean up URL
            window.history.replaceState(null, "", window.location.pathname);
          }
        });
        subscription = authData.subscription;

        // Give Supabase time to process the URL and fire PASSWORD_RECOVERY event
        // Supabase's detectSessionInUrl: true handles token extraction automatically
        // Wait up to 3 seconds, checking every 500ms
        let attempts = 0;
        const maxAttempts = 6;

        while (attempts < maxAttempts && mounted) {
          await new Promise((resolve) => setTimeout(resolve, 500));

          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            console.error("[RESET PASSWORD] ✅ Recovery session found after", attempts * 500, "ms");
            setHasValidSession(true);
            setCheckingSession(false);
            window.history.replaceState(null, "", window.location.pathname);
            return;
          }

          attempts++;
        }

        if (!mounted) return;

        // Final check
        const {
          data: { session: finalSession },
        } = await supabase.auth.getSession();

        if (finalSession) {
          console.error("[RESET PASSWORD] ✅ Recovery session found (final check)");
          setHasValidSession(true);
          setCheckingSession(false);
        } else {
          console.error("[RESET PASSWORD] ❌ No recovery session found after all attempts");
          setHasValidSession(false);
          setCheckingSession(false);
          setError("Invalid or expired reset link. Please request a new one.");
        }
      } catch (err) {
        console.error("[RESET PASSWORD] Error:", err);
        if (mounted) {
          setHasValidSession(false);
          setCheckingSession(false);
          setError("Failed to process reset link. Please try again.");
        }
      }
    };

    initPasswordReset();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
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
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-gray-600">Verifying reset link...</p>
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
