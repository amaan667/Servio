"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw } from "lucide-react";
import { signInUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

export default function SignInForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AUTH DEBUG] SignInForm submit start', { email: formData.email });

    setError(null);

    if (!formData.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!formData.password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      console.log('[AUTH DEBUG] SignInForm calling signInUser');
      const result = await signInUser(formData.email.trim(), formData.password);

      if (result.success) {
        console.log('[AUTH DEBUG] SignInForm sign-in success, resolving destination');
        try {
          const { data: { user } } = await supabase.auth.getUser();
          let dest = '/complete-profile';
          if (user?.id) {
            const { data: venues } = await supabase
              .from('venues')
              .select('venue_id')
              .eq('owner_id', user.id)
              .limit(1);
            if (venues && venues.length > 0) {
              dest = `/dashboard/${venues[0].venue_id}`;
            }
          }
          console.log('[AUTH DEBUG] SignInForm redirecting to', { dest });
          window.location.href = dest;
        } catch (e: any) {
          console.log('[AUTH DEBUG] SignInForm post-login redirect fallback', { message: e?.message });
          window.location.href = '/dashboard';
        }
      } else {
        console.log('[AUTH DEBUG] SignInForm sign-in failed', { message: result.message });
        setError(result.message || "Invalid email or password");
      }
    } catch (error: any) {
      console.log('[AUTH DEBUG] SignInForm unexpected error', { message: error?.message });
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your Servio account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Access your restaurant dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign In Button */}
            <Button
              type="button"
              className="w-full mb-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              onClick={async () => {
                setLoading(true);
                setError(null);

                try {
                  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
                  console.log('[AUTH DEBUG] SignInForm Google button clicked', {
                    redirectTo,
                    env_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
                    env_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
                    nodeEnv: process.env.NODE_ENV,
                  });
                  const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo },
                  });
                  if (error) {
                    console.error('[AUTH DEBUG] OAuth start error', { message: error.message });
                    setError(error.message);
                    setLoading(false);
                    return;
                  }
                  if (data?.url) {
                    console.log('[AUTH DEBUG] SignInForm redirecting browser to Google URL', { url: data.url });
                    window.location.href = data.url; // force navigation
                  } else {
                    console.log('[AUTH DEBUG] SignInForm no OAuth URL returned');
                  }
                } catch (err: any) {
                  console.error('[AUTH DEBUG] Google sign-in error on sign-in page', { message: err?.message });
                  setError(`Google sign-in failed: ${err.message || "Please try again."}`);
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"/><path fill="#EA4335" d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.19-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter your email"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">Sign In</Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link
                  href="/sign-up"
                  className="font-medium text-servio-purple hover:text-servio-purple/80"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
