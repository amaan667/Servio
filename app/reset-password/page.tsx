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
      // This is critical - Supabase will fire PASSWORD_RECOVERY event when hash fragments are processed
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[RESET PASSWORD] Auth state change:", {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
        });

        // PASSWORD_RECOVERY event is fired when Supabase processes recovery hash fragments
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          console.log("[RESET PASSWORD] ✅ Recovery session detected via auth state change");
          setHasValidSession(true);
          // Clear hash from URL for security
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      });

      // Check for hash fragments OR query parameters in URL
      // Supabase can use either depending on configuration
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);

      // Try hash fragments first, then query params
      let accessToken = hashParams.get("access_token") || queryParams.get("access_token");
      let refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
      let type = hashParams.get("type") || queryParams.get("type");

      console.log("[RESET PASSWORD] URL analysis:", {
        fullUrl: window.location.href,
        hash: window.location.hash,
        search: window.location.search,
        pathname: window.location.pathname,
        origin: window.location.origin,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        type,
        hashLength: window.location.hash.length,
        searchLength: window.location.search.length,
        accessTokenPreview: accessToken ? accessToken.substring(0, 20) + "..." : null,
      });

      // If we have tokens, set the session explicitly
      if (accessToken && type === "recovery") {
        try {
          console.log("[RESET PASSWORD] Attempting to set session with tokens...");
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
            userId: sessionData.session?.user?.id,
          });

          if (sessionData.session && !sessionError) {
            setHasValidSession(true);
            // Clear hash/query from URL for security
            if (window.location.hash || window.location.search) {
              window.history.replaceState(null, "", window.location.pathname);
            }
            authListener?.subscription.unsubscribe();
            return;
          } else {
            console.error("[RESET PASSWORD] Failed to set session:", sessionError);
            // Don't set error yet - let Supabase try to process it automatically
          }
        } catch (hashError) {
          console.error("[RESET PASSWORD] Exception setting session:", hashError);
          // Don't set error yet - let Supabase try to process it automatically
        }
      }

      // The Supabase verify endpoint redirects here with hash fragments
      // Supabase client has detectSessionInUrl: true, so it should automatically process them
      // However, we need to wait for:
      // 1. The redirect from verify endpoint to complete (if coming from verify endpoint)
      // 2. Supabase to process the hash fragments
      // 3. The PASSWORD_RECOVERY event to fire

      console.log("[RESET PASSWORD] Waiting for Supabase auto-detection...");
      console.log(
        "[RESET PASSWORD] If you came from verify endpoint, hash fragments should appear after redirect"
      );

      // Check multiple times - the redirect might happen after initial page load
      let attempts = 0;
      const maxAttempts = 6; // 6 attempts * 500ms = 3 seconds total

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Re-check hash fragments in case redirect happened
        const currentHashParams = new URLSearchParams(window.location.hash.substring(1));
        const currentAccessToken = currentHashParams.get("access_token");

        if (currentAccessToken && !accessToken) {
          console.log("[RESET PASSWORD] Hash fragments appeared after redirect, processing...");
          accessToken = currentAccessToken;
          refreshToken = currentHashParams.get("refresh_token") || "";
          type = currentHashParams.get("type") || "";

          // Try to set session with newly found tokens
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

            if (sessionData.session && !sessionError) {
              setHasValidSession(true);
              window.history.replaceState(null, "", window.location.pathname);
              authListener?.subscription.unsubscribe();
              return;
            }
          } catch (_err) {
            // Continue to wait
          }
        }

        // Check if session was established via auth state change listener
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        if (currentSession) {
          console.log("[RESET PASSWORD] ✅ Session found via getSession");
          setHasValidSession(true);
          if (window.location.hash || window.location.search) {
            window.history.replaceState(null, "", window.location.pathname);
          }
          authListener?.subscription.unsubscribe();
          return;
        }

        attempts++;
      }

      // Check if we have a session now
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.log("[RESET PASSWORD] Final session check:", {
        hasSession: !!session,
        hasError: !!sessionError,
        errorMessage: sessionError?.message,
        sessionUserId: session?.user?.id,
        sessionEmail: session?.user?.email,
        sessionExpiresAt: session?.expires_at,
      });

      if (session && !sessionError) {
        setHasValidSession(true);
        // Clear hash/query from URL for security
        if (window.location.hash || window.location.search) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      } else {
        setHasValidSession(false);
        // Provide detailed error message with debugging info
        const errorDetails: string[] = [];

        if (!accessToken && !window.location.hash && !window.location.search) {
          errorDetails.push("No reset token found in URL.");
          errorDetails.push("Please ensure you clicked the link directly from your email.");
          errorDetails.push(`Current URL: ${window.location.href}`);
        } else if (accessToken && !session) {
          errorDetails.push("Token found but session creation failed.");
          if (sessionError) {
            errorDetails.push(`Error: ${sessionError.message}`);
          }
        } else if (sessionError) {
          errorDetails.push(`Reset link error: ${sessionError.message}`);
        } else {
          errorDetails.push("Invalid or expired reset link.");
        }

        errorDetails.push("\nPlease check:");
        errorDetails.push("1. The reset link URL is whitelisted in Supabase Dashboard");
        errorDetails.push("2. You clicked the link within 1 hour of requesting it");
        errorDetails.push("3. Check browser console for detailed logs");

        setError(errorDetails.join("\n"));
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
