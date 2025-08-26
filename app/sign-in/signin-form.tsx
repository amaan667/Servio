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
import { supabase } from "@/lib/sb-client";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
// Removed SessionClearer from production to avoid redundant client-side sign-out

interface SignInFormProps {
  onGoogleSignIn: () => Promise<void>;
  loading?: boolean;
}

export default function SignInForm({ onGoogleSignIn, loading: externalLoading }: SignInFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('[AUTH DEBUG] SignInForm rendered with props:', {
    externalLoading,
    hasEmail: !!formData.email,
    hasPassword: !!formData.password,
    loading,
    error
  });

  // Check for URL parameters
  useEffect(() => {
    console.log('[AUTH DEBUG] SignInForm useEffect - checking URL parameters');
    const urlParams = new URLSearchParams(window.location.search);
    const urlError = urlParams.get('error');
    const errorMessage = urlParams.get('message');
    const signedOut = urlParams.get('signedOut');
    
    console.log('[AUTH DEBUG] URL parameters found:', {
      urlError,
      errorMessage,
      signedOut,
      fullUrl: window.location.href
    });
    
    if (urlError) {
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
      } else if (urlError === 'callback_exception') {
        errorText = errorMessage ? `Authentication error: ${errorMessage}` : 'Authentication process failed. Please try again.';
      } else if (urlError === 'timeout') {
        errorText = 'Authentication timed out. Please try again.';
      } else if (urlError === 'network_error') {
        errorText = 'Network error. Please check your connection and try again.';
      } else if (urlError === 'server_exception') {
        errorText = errorMessage ? `Server error: ${errorMessage}` : 'Server error during authentication. Please try again.';
      } else if (urlError === 'missing_code') {
        errorText = 'Authentication code missing. Please try signing in again.';
      } else if (urlError === 'pkce_failed') {
        errorText = 'Authentication failed. Please try signing in again.';
      }
      
      console.log('[AUTH DEBUG] Setting error from URL parameter:', errorText);
      setError(errorText);
    }
    
    if (signedOut === 'true') {
      console.log('[AUTH DEBUG] User signed out, clearing form data');
      // Clear any remaining form data when coming from sign-out
      setFormData({ email: "", password: "" });
      setError(null);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AUTH DEBUG] Form submit triggered');
    console.log('[AUTH DEBUG] Form data:', {
      email: formData.email,
      hasPassword: !!formData.password,
      passwordLength: formData.password.length
    });

    setError(null);

    if (!formData.email.trim()) {
      console.log('[AUTH DEBUG] Validation failed: missing email');
      setError("Please enter your email address.");
      return;
    }

    if (!formData.password) {
      console.log('[AUTH DEBUG] Validation failed: missing password');
      setError("Please enter your password.");
      return;
    }

    console.log('[AUTH DEBUG] Form validation passed, starting authentication');
    setLoading(true);

    try {
      console.log('[AUTH DEBUG] Calling signInUser function');
      console.log('[AUTH DEBUG] signInUser parameters:', {
        email: formData.email.trim(),
        passwordLength: formData.password.length
      });
      
      const result = await signInUser(formData.email.trim(), formData.password);
      
      console.log('[AUTH DEBUG] signInUser result:', {
        success: result.success,
        message: result.message,
        hasData: !!result.data
      });

      if (result.success) {
        console.log('[AUTH DEBUG] Authentication successful, redirecting to dashboard');
        // Redirect to dashboard (will route to venue or complete-profile as needed)
        router.replace('/dashboard');
      } else {
        console.log('[AUTH DEBUG] Authentication failed:', result.message);
        setError(result.message || "Invalid email or password");
      }
    } catch (error: any) {
      console.error('[AUTH DEBUG] Authentication exception:', error);
      console.error('[AUTH DEBUG] Exception details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      });
      setError("An unexpected error occurred. Please try again.");
    } finally {
      console.log('[AUTH DEBUG] Authentication flow completed, setting loading to false');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('[AUTH DEBUG] Google sign-in button clicked');
    setError(null);
    try {
      console.log('[AUTH DEBUG] Calling onGoogleSignIn prop');
      await onGoogleSignIn();
      console.log('[AUTH DEBUG] onGoogleSignIn completed successfully');
    } catch (err: any) {
      console.error('[AUTH DEBUG] Google sign-in error:', err);
      console.error('[AUTH DEBUG] Google sign-in error details:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
      setError(`Google sign-in failed: ${err.message || "Please try again."}`);
    }
  };

  console.log('[AUTH DEBUG] SignInForm render state:', {
    loading,
    externalLoading,
    error,
    formData: {
      hasEmail: !!formData.email,
      hasPassword: !!formData.password
    }
  });

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
            <Button
              type="button"
              className="w-full mb-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading || externalLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"/><path fill="#EA4335" d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.19-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
              {loading || externalLoading ? 'Redirecting…' : 'Sign in with Google'}
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
                  onChange={(e) => {
                    console.log('[AUTH DEBUG] Email input changed:', e.target.value);
                    setFormData({ ...formData, email: e.target.value });
                  }}
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
                  onChange={(e) => {
                    console.log('[AUTH DEBUG] Password input changed, length:', e.target.value.length);
                    setFormData({ ...formData, password: e.target.value });
                  }}
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
