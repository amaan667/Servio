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
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initPasswordReset = async () => {
      try {
        // Check for error in URL
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorParam = params.get("error") || hashParams.get("error");
        const errorCode = params.get("error_code") || hashParams.get("error_code");
        const errorDescription =
          params.get("error_description") || hashParams.get("error_description");

        if (errorParam && mounted) {
          window.history.replaceState(null, "", window.location.pathname);
          setCheckingSession(false);
          setHasValidSession(false);

          const isExpiredLink =
            errorCode === "otp_expired" ||
            errorDescription?.toLowerCase().includes("expired") ||
            errorDescription?.toLowerCase().includes("invalid");

          if (isExpiredLink) {
            setIsExpired(true);
            setError(
              "This password reset link has expired. Reset links are valid for 1 hour. Please request a new one."
            );
          } else {
            setError(errorDescription || "Reset link is invalid. Please request a new one.");
          }
          return;
        }

        // Check if we have a code - try to verify it server-side first
        const code = params.get("code");
        if (code) {
          try {
            const response = await fetch("/api/auth/verify-reset-code", {

              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),

            const data = await response.json();

            if (response.ok && data.session) {
              // Set the session using the tokens from server
              const { error: sessionError } = await supabase.auth.setSession({

              if (!sessionError) {
                setHasValidSession(true);
                setCheckingSession(false);
                window.history.replaceState(null, "", window.location.pathname);
                subscription?.unsubscribe();
                return;
              }
            }
          } catch (err) {
            // Fall through to auto-detection
          }
        }

        // Listen for PASSWORD_RECOVERY event - Supabase handles codes automatically
        const { data: authData } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;

          if (event === "PASSWORD_RECOVERY" && session) {
            setHasValidSession(true);
            setCheckingSession(false);
            setError(null);
            window.history.replaceState(null, "", window.location.pathname);
            subscription?.unsubscribe();
          }

        subscription = authData.subscription;

        // Give Supabase time to process the URL automatically (detectSessionInUrl: true)
        // Poll for session establishment
        let attempts = 0;
        const maxAttempts = 10; // 5 seconds total

        while (attempts < maxAttempts && mounted) {
          await new Promise((resolve) => setTimeout(resolve, 500));

          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            setHasValidSession(true);
            setCheckingSession(false);
            window.history.replaceState(null, "", window.location.pathname);
            subscription?.unsubscribe();
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
          setHasValidSession(true);
          setCheckingSession(false);
          subscription?.unsubscribe();
        } else {
          setHasValidSession(false);
          setCheckingSession(false);
          setError("Invalid or expired reset link. Please request a new one.");
          subscription?.unsubscribe();
        }
      } catch (err) {
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
      const { error: updateError } = await supabase.auth.updateUser({

      if (updateError) {
        setError(updateError.message || "Failed to reset password. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      await supabase.auth.signOut();

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
          ) : isExpired ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  <strong>Link Expired</strong>
                  <br />
                  {error}
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-2">
                <Button onClick={() => router.push("/forgot-password")} className="w-full">
                  Request New Reset Link
                </Button>
                <Button
                  onClick={() => router.push("/sign-in")}
                  variant="outline"
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </div>
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
