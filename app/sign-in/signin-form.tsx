'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signInUser } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/auth/signin';

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleSignInInProgress = useRef(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Clear any stale authentication state when the sign-in form loads
  useEffect(() => {
    const clearStaleAuth = async () => {
      try {
        console.log('[AUTH DEBUG] SignInForm: clearing stale authentication state');
        const { createClient, clearAuthStorage } = await import('@/lib/sb-client');
        
        // Clear any existing session
        await createClient().auth.signOut({ scope: 'local' });
        
        // Clear any PKCE artifacts
        clearAuthStorage();
        
        console.log('[AUTH DEBUG] SignInForm: stale auth state cleared');
      } catch (err) {
        console.log('[AUTH DEBUG] SignInForm: error clearing stale auth state', err);
      }
    };
    
    clearStaleAuth();
  }, []);

  // Handle error parameters from URL (e.g., from auth callback)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      let errorMessage = 'Sign-in failed. Please try again.';
      
      switch (errorParam) {
        case 'timeout':
          errorMessage = 'Sign-in request timed out. Please try again.';
          break;
        case 'oauth_error':
          errorMessage = 'OAuth authentication failed. Please try again.';
          break;
        case 'missing_code':
          errorMessage = 'Authentication code is missing. Please try again.';
          break;
        case 'missing_verifier':
          errorMessage = 'Authentication verifier is missing. Please try again.';
          break;
        case 'exchange_failed':
          errorMessage = 'Failed to complete authentication. Please try again.';
          break;
        case 'no_session':
          errorMessage = 'No session was created. Please try again.';
          break;
        default:
          errorMessage = `Sign-in error: ${errorParam}`;
      }
      
      setError(errorMessage);
      setLoading(false); // Reset loading state when there's an error
      googleSignInInProgress.current = false; // Reset the ref
      
      // Clear the error from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.pathname + (url.search ? `?${url.searchParams}` : ''));
    }
  }, [searchParams]);

  // Cleanup effect to reset the ref when component unmounts
  useEffect(() => {
    return () => {
      googleSignInInProgress.current = false;
    };
  }, []);

  // Debug effect to log current auth state (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const checkAuthState = async () => {
        try {
          const { createClient } = await import('@/lib/sb-client');
          const { data, error } = await createClient().auth.getSession();
          console.log('[AUTH DEBUG] SignInForm: current auth state', {
            hasSession: !!data.session,
            hasUser: !!data.session?.user,
            userId: data.session?.user?.id,
            error: error?.message,
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.log('[AUTH DEBUG] SignInForm: error checking auth state', err);
        }
      };
      
      checkAuthState();
    }
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signInUser(formData.email, formData.password);
      
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.message || 'Sign in failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('[AUTH DEBUG] Google sign-in button clicked');
    
    // Prevent multiple simultaneous requests
    if (googleSignInInProgress.current) {
      console.log('[AUTH DEBUG] Google sign-in already in progress, ignoring click');
      return;
    }
    
    googleSignInInProgress.current = true;
    setLoading(true);
    setError(null);
    
    try {
      await signInWithGoogle();
      console.log('[AUTH DEBUG] Google sign-in initiated, redirect should happen automatically');
      // The redirect will happen automatically via window.location.href in signInWithGoogle
      // We don't reset loading here because the page will redirect
    } catch (err: any) {
      console.error('[AUTH DEBUG] Google sign-in failed:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      if (err?.message?.includes('popup')) {
        errorMessage = 'Pop-up blocked. Please allow pop-ups for this site and try again.';
      } else if (err?.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (err?.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (err?.message?.includes('cancelled')) {
        errorMessage = 'Sign-in was cancelled. Please try again.';
      } else if (err?.message) {
        errorMessage = `Sign-in error: ${err.message}`;
      }
      
      setError(errorMessage);
      setLoading(false);
      googleSignInInProgress.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your Servio account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <g>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"/>
                <path fill="#FBBC05" d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"/>
                <path fill="#EA4335" d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.19-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </g>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>

          {/* Debug Buttons - Only in development */}
          {process.env.NODE_ENV === 'development' && (
            <>
              <Button
                onClick={() => {
                  console.log('[AUTH DEBUG] Current URL:', window.location.href);
                  console.log('[AUTH DEBUG] Site origin:', window.location.origin);
                  console.log('[AUTH DEBUG] Redirect URL:', `${window.location.origin}/auth/callback`);
                  console.log('[AUTH DEBUG] LocalStorage keys:', Object.keys(localStorage));
                }}
                variant="outline"
                className="w-full text-xs"
              >
                Debug OAuth Config
              </Button>

              <Button
                onClick={async () => {
                  try {
                    const { createClient, checkPKCEState, checkAuthState } = await import('@/lib/sb-client');
                    console.log('[AUTH DEBUG] === Testing Auth State ===');
                    console.log('[AUTH DEBUG] PKCE State:', checkPKCEState());
                    console.log('[AUTH DEBUG] Auth State:', await checkAuthState());
                    console.log('[AUTH DEBUG] Current session:', await createClient().auth.getSession());
                  } catch (err) {
                    console.error('[AUTH DEBUG] Error testing auth state:', err);
                  }
                }}
                variant="outline"
                className="w-full text-xs"
              >
                Test Auth State
              </Button>

              <Button
                onClick={async () => {
                  try {
                    const { clearAuthStorage } = await import('@/lib/sb-client');
                    console.log('[AUTH DEBUG] === Clearing Auth State ===');
                    clearAuthStorage();
                    console.log('[AUTH DEBUG] Auth state cleared, reloading page...');
                    window.location.reload();
                  } catch (err) {
                    console.error('[AUTH DEBUG] Error clearing auth state:', err);
                  }
                }}
                variant="outline"
                className="w-full text-xs"
              >
                Clear Auth State
              </Button>

              <Button
                onClick={async () => {
                  try {
                    const { createClient } = await import('@/lib/sb-client');
                    console.log('[AUTH DEBUG] === Force Clearing Session ===');
                    await createClient().auth.signOut({ scope: 'local' });
                    console.log('[AUTH DEBUG] Session cleared, reloading page...');
                    window.location.reload();
                  } catch (err) {
                    console.error('[AUTH DEBUG] Error clearing session:', err);
                  }
                }}
                variant="outline"
                className="w-full text-xs"
              >
                Force Clear Session
              </Button>

              <Button
                onClick={async () => {
                  try {
                    const { createClient } = await import('@/lib/sb-client');
                    const { siteOrigin } = await import('@/lib/site');
                    const sb = createClient();
                    const redirectUrl = `${siteOrigin()}/auth/callback`;
                    
                    console.log('[AUTH DEBUG] === Testing OAuth URL ===');
                    console.log('[AUTH DEBUG] Redirect URL:', redirectUrl);
                    
                    const { data, error } = await sb.auth.signInWithOAuth({
                      provider: "google",
                      options: {
                        flowType: "pkce",
                        redirectTo: redirectUrl,
                      },
                    });
                    
                    console.log('[AUTH DEBUG] OAuth URL test result:', {
                      hasData: !!data,
                      hasError: !!error,
                      errorMessage: error?.message,
                      url: data?.url,
                      urlLength: data?.url?.length
                    });
                    
                    if (data?.url) {
                      console.log('[AUTH DEBUG] OAuth URL (first 100 chars):', data.url.substring(0, 100));
                    }
                  } catch (err) {
                    console.error('[AUTH DEBUG] Error testing OAuth URL:', err);
                  }
                }}
                variant="outline"
                className="w-full text-xs"
              >
                Test OAuth URL
              </Button>
            </>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                disabled={loading}
                required
                className="transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                disabled={loading}
                required
                className="transition-colors"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full transition-colors">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/sign-up" className="text-purple-600 hover:text-purple-500 font-medium transition-colors">
              Sign up here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
