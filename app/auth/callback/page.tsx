"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        console.log('[AUTH DEBUG] OAuth callback started');
        // Use the main Supabase client instance
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.has("code");
        const hasError = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const state = url.searchParams.get("state");

        console.log('[AUTH DEBUG] Callback params:', { 
          hasCode, 
          hasError, 
          errorDescription,
          hasState: !!state,
          fullUrl: window.location.href,
          allParams: Object.fromEntries(url.searchParams.entries())
        });

        // Check environment variables
        console.log('[AUTH DEBUG] Environment check:', {
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        });

        if (hasError) {
          console.error('[AUTH DEBUG] OAuth error in callback:', { hasError, errorDescription });
          setErrorMessage(errorDescription || 'Authentication failed');
          setStatus('error');
          setTimeout(() => router.replace("/sign-in?error=oauth_error"), 3000);
          return;
        }

        if (hasCode) {
          console.log('[AUTH DEBUG] Exchanging code for session');
          
          // For client-side PKCE, pass the full URL to include all necessary parameters
          console.log('[AUTH DEBUG] Using full URL for PKCE exchange:', window.location.href);
          console.log('[AUTH DEBUG] URL search params:', Object.fromEntries(url.searchParams.entries()));
          
          // Ensure we have the code and state parameters for PKCE
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          
          if (!code) {
            console.error('[AUTH DEBUG] No code parameter found in URL');
            setErrorMessage('Missing authorization code');
            setStatus('error');
            setTimeout(() => router.replace("/sign-in?error=no_code"), 3000);
            return;
          }
          
          // Add timeout to prevent hanging
          const exchangePromise = supabase.auth.exchangeCodeForSession(window.location.href);
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Exchange timeout after 15 seconds')), 15000); // Increased timeout
          });
          
          const { data, error } = await Promise.race([exchangePromise, timeoutPromise]) as any;
          
          if (error) {
            console.error('[AUTH DEBUG] Exchange error:', {
              message: error.message,
              status: error.status,
              name: error.name,
              stack: error.stack
            });
            setErrorMessage(error.message || 'Failed to complete authentication');
            setStatus('error');
            setTimeout(() => router.replace(`/sign-in?error=exchange_failed&message=${encodeURIComponent(error.message)}`), 3000);
            return;
          }

          console.log('[AUTH DEBUG] Session exchange successful:', { 
            hasUser: !!data?.user, 
            userId: data?.user?.id,
            hasSession: !!data?.session,
            sessionExpiresAt: data?.session?.expires_at
          });

          // Handle Google OAuth user - create venue if needed
          if (data?.user) {
            const user = data.user;
            const isGoogleUser = user.app_metadata?.provider === 'google' || 
                               user.identities?.some(identity => identity.provider === 'google');
            
            if (isGoogleUser) {
              console.log('[AUTH DEBUG] Google user detected, checking for venue');
              try {
                // Check if user already has a venue
                const { data: venues, error: venueError } = await supabase
                  .from('venues')
                  .select('*')
                  .eq('owner_id', user.id)
                  .limit(1);

                if (venueError) {
                  console.error('[AUTH DEBUG] Error checking venues:', venueError);
                } else if (!venues || venues.length === 0) {
                  // Create default venue for Google user
                  console.log('[AUTH DEBUG] Creating default venue for Google user');
                  const venueId = `venue-${user.id.slice(0, 8)}`;
                  const venueName = user.user_metadata?.full_name 
                    ? `${user.user_metadata.full_name}'s Business` 
                    : 'My Business';
                  
                  const { error: createError } = await supabase
                    .from('venues')
                    .insert({
                      venue_id: venueId,
                      name: venueName,
                      business_type: 'Restaurant',
                      owner_id: user.id,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    });

                  if (createError) {
                    console.error('[AUTH DEBUG] Error creating venue:', createError);
                  } else {
                    console.log('[AUTH DEBUG] Default venue created for Google user');
                  }
                } else {
                  console.log('[AUTH DEBUG] Google user already has venue:', venues[0].venue_id);
                }
              } catch (venueError) {
                console.error('[AUTH DEBUG] Error handling Google user venue:', venueError);
              }
            }
          }

          // Clean up URL
          url.searchParams.delete("code"); 
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
          
          setStatus('success');
          setTimeout(() => router.replace("/dashboard"), 1000);
        } else {
          console.log('[AUTH DEBUG] No code found in callback, redirecting to sign-in');
          setErrorMessage('No authorization code received');
          setStatus('error');
          setTimeout(() => router.replace("/sign-in?error=no_code"), 3000);
        }
      } catch (error: any) {
        console.error('[AUTH DEBUG] Callback exception:', {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
          cause: error?.cause
        });
        
        // Provide more specific error messages based on the error type
        let userMessage = 'Unexpected error during authentication';
        let errorCode = 'callback_exception';
        
        if (error?.message?.includes('timeout')) {
          userMessage = 'Authentication timed out. Please try again.';
          errorCode = 'timeout';
        } else if (error?.message?.includes('network')) {
          userMessage = 'Network error. Please check your connection and try again.';
          errorCode = 'network_error';
        } else if (error?.message?.includes('fetch')) {
          userMessage = 'Connection error. Please try again.';
          errorCode = 'fetch_error';
        }
        
        setErrorMessage(userMessage);
        setStatus('error');
        setTimeout(() => router.replace(`/sign-in?error=${errorCode}&message=${encodeURIComponent(userMessage)}`), 3000);
      }
    })();
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Completing sign-in...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <p className="text-gray-600 mb-2">Authentication failed</p>
          <p className="text-sm text-gray-500">{errorMessage}</p>
          <p className="text-xs text-gray-400 mt-2">Redirecting to sign-in...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-500 text-2xl mb-2">✅</div>
          <p className="text-gray-600">Sign-in successful!</p>
          <p className="text-xs text-gray-400 mt-2">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
}
