"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import { CheckCircle2 } from "lucide-react";

interface SignInFormProps {
  onGoogleSignIn: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export default function SignInForm({
  onGoogleSignIn,
  isLoading = false,
  error: propError,
  onClearError,
}: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for password reset success
  useEffect(() => {
    if (searchParams.get("passwordReset") === "true") {
      setPasswordResetSuccess(true);
      // Clear the URL parameter
      router.replace("/sign-in", { scroll: false });
    }
  }, [searchParams, router]);

  // Use prop error if provided, otherwise use local error
  const displayError = propError || error;

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownUntil && Date.now() < cooldownUntil) {
      return; // Prevent attempts during cooldown
    }
    setLoading(true);
    setError(null);

    try {
      // Clear all dashboard caches before signing in to prevent stale data
      if (typeof window !== "undefined") {
        Object.keys(sessionStorage).forEach((key) => {
          if (
            key.startsWith("dashboard_user_") ||
            key.startsWith("dashboard_venue_") ||
            key.startsWith("user_role_") ||
            key.startsWith("venue_id_")
          ) {
            sessionStorage.removeItem(key);
          }
        });
      }

      // Use server-side API route to properly set cookies
      const response = await fetch("/api/auth/sign-in-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Ensure cookies are sent/received
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data.error || "Sign-in failed. Please try again.";
        // If we hit rate limits, place a longer cooldown for mobile
        if (/rate limit/i.test(msg)) {
          const waitMs = 60_000; // 60s cooldown
          setCooldownUntil(Date.now() + waitMs);
          setTimeout(() => setCooldownUntil(null), waitMs);
          setError("Too many sign-in attempts. Please wait 1 minute and try again.");
        } else if (/network|connection|timeout/i.test(msg)) {
          setError("Connection issue. Please check your internet and try again.");
        } else if (/invalid.*credentials/i.test(msg) || /invalid login/i.test(msg)) {
          setError("Invalid email or password. Please check and try again.");
        } else {
          setError(msg);
        }
        setLoading(false);
        return;
      }

      if (data.success && data.redirectTo) {
        // Set session in browser storage BEFORE redirecting
        // This ensures the browser Supabase client can read it immediately
        if (data.session) {
          const { createClient } = await import("@/lib/supabase");
          const supabase = await createClient();

          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          if (setSessionError) {
            setError("Failed to establish session. Please try again.");
            setLoading(false);
            return;
          }

          // CRITICAL: Wait for Safari to persist cookies
          // Mobile Safari needs MORE time than desktop Safari to persist cookies
          const isMobileSafari =
            /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
          const cookieDelay = isMobileSafari ? 1500 : 500;

          await new Promise((resolve) => setTimeout(resolve, cookieDelay));

          // Double-check session is set
          const {
            data: { session: verifySession },
          } = await supabase.auth.getSession();

          if (!verifySession) {
            setError("Failed to establish session. Please try again.");
            setLoading(false);
            return;
          }

          // Handle generic /dashboard redirect (from timeout/Safari)
          if (data.redirectTo === "/dashboard" && data.hasVenues) {
            const { data: venues } = await supabase
              .from("venues")
              .select("venue_id, created_at")
              .eq("owner_user_id", verifySession.user.id)
              .order("created_at", { ascending: true })
              .limit(1);

            if (venues && venues.length > 0) {
              window.location.href = `/dashboard/${venues[0].venue_id}`;
              return;
            }
          }
        }

        window.location.href = data.redirectTo;
      }
    } catch (_err) {
      const msg = _err instanceof Error ? _err.message : "Sign-in failed. Please try again.";
      if (/rate limit/i.test(msg)) {
        const waitMs = 30_000;
        setCooldownUntil(Date.now() + waitMs);
        setTimeout(() => setCooldownUntil(null), waitMs);
      }
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-4 sm:p-6 lg:p-8">
      <NavigationBreadcrumb showBackButton={false} />

      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Welcome to Servio</h1>
        <p className="text-sm sm:text-base text-gray-700">Sign in to manage your venue</p>
      </div>

      {passwordResetSuccess && (
        <Alert className="mb-4 sm:mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Password reset successful!</strong> You can now sign in with your new password.
          </AlertDescription>
        </Alert>
      )}

      {displayError && (
        <Alert variant="destructive" className="mb-4 sm:mb-6">
          <AlertDescription>
            {displayError}
            {onClearError && (
              <button onClick={onClearError} className="ml-2 text-sm underline hover:no-underline">
                Dismiss
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Google Sign In Button */}
      <Button
        onClick={onGoogleSignIn}
        disabled={isLoading || loading}
        variant="servio"
        className="w-full flex items-center justify-center gap-2 mb-4 sm:mb-6 h-10 sm:h-11 font-medium !text-white bg-servio-purple"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span className="text-sm sm:text-base font-medium !text-white">
          {isLoading ? "Signing in..." : "Sign in with Google"}
        </span>
      </Button>

      <div className="relative mb-4 sm:mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-600">Or continue with email</span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSignIn} className="space-y-3 sm:space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm sm:text-base">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            disabled={loading || isLoading}
            required
            className="h-10 sm:h-11 text-sm sm:text-base"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm sm:text-base">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs sm:text-sm text-servio-purple hover:opacity-80 font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loading || isLoading}
            required
            className="h-10 sm:h-11 text-sm sm:text-base"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || isLoading}
          variant="servio"
          className="w-full h-10 sm:h-11 text-sm sm:text-base !text-white bg-servio-purple"
        >
          <span className="!text-white font-medium">
          {loading ? "Signing in..." : "Sign in with Email"}
          </span>
        </Button>
      </form>

      <div className="mt-4 sm:mt-6 text-center">
        <p className="text-sm text-gray-700">
          New to Servio?{" "}
          <Link href="/sign-up" className="text-servio-purple hover:opacity-80 font-medium">
            Start Free Trial
          </Link>
        </p>
      </div>
    </div>
  );
}
