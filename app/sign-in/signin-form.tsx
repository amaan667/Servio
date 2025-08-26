"use client";

import { useState, useEffect } from "react";
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
// Removed RefreshCw icon import for Clean Refresh button cleanup
import { signInUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
// Removed SessionClearer from production to avoid redundant client-side sign-out

interface SignInFormProps {
  loading?: boolean;
}

export default function SignInForm({ loading: externalLoading }: SignInFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for URL parameters
  useEffect(() => {
    console.log('[AUTH DEBUG] ===== SignInForm Component Mounted =====');
    console.log('[AUTH DEBUG] Current URL:', window.location.href);
    console.log('[AUTH DEBUG] User agent:', navigator.userAgent);
    console.log('[AUTH DEBUG] Timestamp:', new Date().toISOString());
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlError = urlParams.get('error');
    const errorMessage = urlParams.get('message');
    const signedOut = urlParams.get('signedOut');
    
    console.log('[AUTH DEBUG] URL parameters found:', {
      error: urlError,
      message: errorMessage,
      signedOut: signedOut
    });
    
    if (urlError) {
      console.log('[AUTH DEBUG] ❌ ERROR: Processing URL error parameter:', urlError);
      let errorText = `Authentication error: ${urlError}`;
      
      // Handle specific error cases
      if (urlError === 'token_reused') {
        errorText = 'Your session has expired. Please sign in again.';
      } else if (urlError === 'validation_failed') {
        errorText = 'Authentication validation failed. Please try again.';
      } else if (urlError === 'oauth_error') {
        errorText = errorMessage ? `OAuth error: ${errorMessage}` : 'OAuth authentication failed.';
      } else if (urlError === 'exchange_failed') {
        errorText = errorMessage ? `Authentication failed: ${errorMessage}` : 'Authentication exchange failed.';
      } else if (urlError === 'missing_code') {
        errorText = 'Authentication code missing. Please try signing in again.';
      } else if (urlError === 'pkce_failed') {
        errorText = 'Authentication failed. Please try signing in again.';
      } else if (urlError === 'timeout') {
        errorText = 'Authentication timed out. Please try signing in again.';
      } else if (urlError === 'unexpected_error') {
        errorText = 'An unexpected error occurred during authentication. Please try again.';
      } else if (urlError === 'oauth_restart_failed') {
        errorText = 'OAuth restart failed. Please try signing in again.';
      } else if (urlError === 'oauth_restart_exception') {
        errorText = 'OAuth restart encountered an exception. Please try signing in again.';
      }
      
      console.log('[AUTH DEBUG] Setting error message:', errorText);
      setError(errorText);
    }
    
    if (signedOut === 'true') {
      console.log('[AUTH DEBUG] User signed out, clearing form data');
      // Clear any remaining form data when coming from sign-out
      setFormData({ email: "", password: "" });
      setError(null);
    }
    
    console.log('[AUTH DEBUG] ===== SignInForm Component Mounted =====');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AUTH DEBUG] ===== Email/Password Sign In Started =====');
    console.log('[AUTH DEBUG] Form data:', { email: formData.email, hasPassword: !!formData.password });

    setError(null);

    if (!formData.email.trim()) {
      console.log('[AUTH DEBUG] ❌ VALIDATION: Email is empty');
      setError("Please enter your email address.");
      return;
    }

    if (!formData.password) {
      console.log('[AUTH DEBUG] ❌ VALIDATION: Password is empty');
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    console.log('[AUTH DEBUG] 🔄 Calling signInUser function');

    try {
      const result = await signInUser(formData.email.trim(), formData.password);

      if (result.success) {
        console.log('[AUTH DEBUG] ✅ Email/password sign-in successful, redirecting to dashboard');
        // Force a page refresh to ensure auth state is updated
        window.location.href = '/dashboard';
      } else {
        console.log('[AUTH DEBUG] ❌ Email/password sign-in failed:', { message: result.message });
        setError(result.message || "Invalid email or password");
      }
    } catch (error: any) {
      console.log('[AUTH DEBUG] ❌ EXCEPTION: Email/password sign-in error:', { message: error?.message });
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
      console.log('[AUTH DEBUG] ===== Email/Password Sign In Completed =====');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md w-full mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <NavigationBreadcrumb showBackButton={false} />
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your Servio account
          </p>
        </div>

        <div className="mt-8">
          <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Access your restaurant dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign In Button */}
            <GoogleSignInButton
              onError={(error) => setError(error)}
              disabled={loading || externalLoading}
              className="w-full mb-4"
            />

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

            <div className="mt-6 text-center space-y-2">
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
    </div>
  );
}
