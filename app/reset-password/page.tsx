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
    // Check if we have a valid recovery session from Supabase
    const checkSession = async () => {
      const supabase = supabaseBrowser();

      // Set up auth state change listener to catch recovery session
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[RESET PASSWORD] Auth state change:", { event, hasSession: !!session });
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          setHasValidSession(true);
          // Clear hash from URL for security
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      });

      // Check for hash fragments in URL (Supabase password reset uses hash fragments)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      console.log("[RESET PASSWORD] Hash fragments:", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        type,
        hashLength: window.location.hash.length,
        hashPreview: window.location.hash.substring(0, 100),
      });

      // If we have hash fragments, set the session explicitly
      if (accessToken && type === "recovery") {
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });

          console.log("[RESET PASSWORD] Set session result:", {
            hasSession: !!sessionData.session,
            hasError: !!sessionError,
            errorMessage: sessionError?.message,
            errorCode: sessionError?.code,
            errorStatus: sessionError?.status,
          });

          if (sessionData.session && !sessionError) {
            setHasValidSession(true);
            // Clear hash from URL for security
            window.history.replaceState(null, "", window.location.pathname);
            authListener?.subscription.unsubscribe();
            return;
          } else {
            console.error("[RESET PASSWORD] Failed to set session from hash:", sessionError);
            setHasValidSession(false);
            setError(
              sessionError?.message ||
                "Invalid or expired reset link. Please request a new password reset link."
            );
            authListener?.subscription.unsubscribe();
            return;
          }
        } catch (hashError) {
          console.error("[RESET PASSWORD] Error processing hash fragments:", hashError);
          setHasValidSession(false);
          setError("Failed to process reset link. Please request a new password reset link.");
          authListener?.subscription.unsubscribe();
          return;
        }
      }

      // Wait for Supabase to automatically process hash fragments (it has detectSessionInUrl: true)
      // Give it more time to process
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check if we have a session now
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log("[RESET PASSWORD] Session check after wait:", {
        hasSession: !!session,
        hasError: !!sessionError,
        errorMessage: sessionError?.message,
        sessionType: session?.user?.app_metadata?.provider,
      });

      if (session && !sessionError) {
        setHasValidSession(true);
        // Clear hash from URL for security
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      } else {
        setHasValidSession(false);
        if (!accessToken) {
          // No hash fragments and no session - invalid link
          setError("Invalid reset link. Please request a new password reset link.");
        } else {
          // Had hash fragments but couldn't create session
          setError(
            sessionError?.message ||
              "Invalid or expired reset link. Please request a new password reset link."
          );
        }
      }

      // Clean up listener
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
