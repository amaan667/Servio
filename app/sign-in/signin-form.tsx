'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw } from 'lucide-react';
import { signInUser } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/supabase';

export default function SignInForm() {
  const googleSignInInProgress = { current: false };
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!formData.password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInUser(formData.email.trim(), formData.password);
      if (!result.success) {
        setError(result.message || 'Invalid email or password');
      } else {
        // Use consistent redirect logic for all platforms
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('[SIGNIN FORM] Step 1: Google sign-in button clicked');
    console.log('[SIGNIN FORM] Current window location: ', window.location.href);
    console.log('[SIGNIN FORM] Current window origin: ', window.location.origin);
    console.log('[AUTH DEBUG] Google sign-in button clicked');
    console.log('[AUTH DEBUG] User agent:', navigator.userAgent);
    console.log('[AUTH DEBUG] Is mobile:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    
    // Prevent multiple simultaneous requests
    if (googleSignInInProgress.current) {
      console.log('[AUTH DEBUG] Google sign-in already in progress, ignoring click');
      return;
    }
    
    googleSignInInProgress.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Check if we're on desktop and warn about popup blocking
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (!isMobile) {
        console.log('[AUTH DEBUG] Desktop detected, checking for popup blockers');
        // Test if popups are blocked
        const popupTest = window.open('', '_blank', 'width=1,height=1');
        if (!popupTest || popupTest.closed || typeof popupTest.closed === 'undefined') {
          console.log('[AUTH DEBUG] Popup blocker detected');
          setError('Popup blocker detected. Please allow pop-ups for this site and try again.');
          setLoading(false);
          googleSignInInProgress.current = false;
          return;
        } else {
          popupTest.close();
          console.log('[AUTH DEBUG] Popup test successful');
        }
      }
      
      console.log('[SIGNIN FORM] Step 2: Calling signInWithGoogle function');
      await signInWithGoogle();
      console.log('[SIGNIN FORM] Step 3: signInWithGoogle completed');
      // Redirect handled by OAuth callback - consistent across all platforms
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
          <CardDescription>Access your Servio account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleGoogleSignIn} disabled={loading} className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"/><path fill="#EA4335" d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.98-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </Button>
          {/* Debug Button - Remove this in production */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={() => {
                console.log('[AUTH DEBUG] Current URL:', process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app');
                console.log('[AUTH DEBUG] Site origin:', process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app');
                console.log('[AUTH DEBUG] Redirect URL:', `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}/auth/callback`);
                console.log('[AUTH DEBUG] LocalStorage keys:', Object.keys(localStorage));
              }}
              variant="outline"
              className="w-full text-xs"
            >
              Debug OAuth Config
            </Button>
          )}

          {/* Test Auth State Button - Remove this in production */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={async () => {
                try {
                  const { createClient, checkPKCEState, checkAuthState } = await import('@/lib/supabase/client');
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
          )}

          {/* Clear Auth State Button - Remove this in production */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={async () => {
                try {
                  const { clearAuthStorage } = await import('@/lib/supabase/client');
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
          )}

          {/* Test OAuth URL Button - Remove this in production */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={async () => {
                try {
                  const { createClient } = await import('@/lib/sb-client');
                  const { siteOrigin } = await import('@/lib/site');
                  const sb = createClient();
                  const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}/auth/callback`;
                  
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
          )}

          {/* Comprehensive Test Button - Remove this in production */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={async () => {
                console.log('[AUTH DEBUG] === COMPREHENSIVE SIGN-IN TEST ===');
                
                // Test 1: Basic button click functionality
                console.log('[AUTH DEBUG] Test 1: Button click works ✓');
                
                // Test 2: User agent detection
                const userAgent = navigator.userAgent;
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
                console.log('[AUTH DEBUG] Test 2: User agent detection', {
                  userAgent,
                  isMobile,
                  isDesktop: !isMobile
                });
                
                // Test 3: Environment variables
                console.log('[AUTH DEBUG] Test 3: Environment check', {
                  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing',
                  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
                  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'
                });
                
                // Test 4: Site origin calculation
                const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app';
                const redirectUrl = `${origin}/auth/callback`;
                console.log('[AUTH DEBUG] Test 4: Site origin calculation', {
                  origin,
                  redirectUrl,
                  productionUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'
                });
                
                // Test 5: Popup blocker test (desktop only)
                if (!isMobile) {
                  console.log('[AUTH DEBUG] Test 5: Popup blocker test (desktop)');
                  const popupTest = window.open('', '_blank', 'width=1,height=1');
                  if (!popupTest || popupTest.closed || typeof popupTest.closed === 'undefined') {
                    console.log('[AUTH DEBUG] ❌ Popup blocker detected');
                    alert('Popup blocker detected! This will prevent Google sign-in from working.');
                  } else {
                    popupTest.close();
                    console.log('[AUTH DEBUG] ✓ Popup test successful');
                  }
                } else {
                  console.log('[AUTH DEBUG] Test 5: Skipped (mobile device)');
                }
                
                // Test 6: Supabase client creation
                try {
                  const { createClient } = await import('@/lib/supabase/client');
                  const sb = createClient();
                  console.log('[AUTH DEBUG] Test 6: Supabase client creation ✓');
                  
                  // Test 7: Current auth state
                  const { data, error } = await sb.auth.getSession();
                  console.log('[AUTH DEBUG] Test 7: Current auth state', {
                    hasSession: !!data.session,
                    hasUser: !!data.session?.user,
                    userId: data.session?.user?.id,
                    error: error?.message
                  });
                  
                } catch (err) {
                  console.log('[AUTH DEBUG] Test 6-7: Supabase client error', err);
                }
                
                // Test 8: OAuth URL generation test
                try {
                  const { createClient } = await import('@/lib/supabase/client');
                  const sb = createClient();
                  
                  console.log('[AUTH DEBUG] Test 8: OAuth URL generation test');
                  const { data, error } = await sb.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      flowType: "pkce",
                      redirectTo: redirectUrl,
                      skipBrowserRedirect: true // Don't actually redirect, just test URL generation
                    },
                  });
                  
                  if (error) {
                    console.log('[AUTH DEBUG] ❌ OAuth URL generation failed:', error.message);
                  } else if (data?.url) {
                    console.log('[AUTH DEBUG] ✓ OAuth URL generated successfully');
                    console.log('[AUTH DEBUG] OAuth URL (first 100 chars):', data.url.substring(0, 100));
                  } else {
                    console.log('[AUTH DEBUG] ❌ No OAuth URL received');
                  }
                  
                } catch (err) {
                  console.log('[AUTH DEBUG] Test 8: OAuth URL generation error', err);
                }
                
                console.log('[AUTH DEBUG] === COMPREHENSIVE TEST COMPLETE ===');
                alert('Comprehensive test complete! Check console for detailed results.');
              }}
              variant="outline"
              className="w-full text-xs bg-yellow-50 border-yellow-200 text-yellow-800"
            >
              🧪 Comprehensive Sign-In Test
            </Button>
          )}


          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with email</span>
            </div>
          </div>

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
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (<><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Signing In...</>) : ('Sign In')}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/sign-up" className="text-purple-600 hover:text-purple-500 font-medium">Sign up here</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
