"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OAuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    (async () => {
      try {
        console.log('[AUTH DEBUG] OAuth callback page: processing callback');
        console.log('[AUTH DEBUG] OAuth callback: URL details:', {
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          pathname: window.location.pathname,
          timestamp: new Date().toISOString()
        });
        
        // Try to read from ?query and fallback to #hash if needed
        let qs = new URLSearchParams(window.location.search);
        if (!qs.get("code") && window.location.hash?.includes("code=")) {
          console.log('[AUTH DEBUG] OAuth callback: No code in search params, checking hash...');
          qs = new URLSearchParams(window.location.hash.slice(1));
        }

        // Debug log
        console.log("[AUTH DEBUG] OAuth callback: Parsed URL params", {
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          codePresent: !!qs.get("code"),
          errorPresent: !!qs.get("error"),
          allParams: Object.fromEntries(qs.entries()),
          timestamp: new Date().toISOString()
        });

        const code = qs.get("code");
        const err = qs.get("error");

        if (err) {
          console.error('[AUTH DEBUG] OAuth callback: OAuth error in callback:', {
            error: err,
            timestamp: new Date().toISOString()
          });
          router.replace('/sign-in?error=oauth_error');
          return;
        }

        if (!code) {
          console.error('[AUTH DEBUG] OAuth callback: No authorization code in callback - redirecting to sign-in');
          // Redirect to sign-in page instead of showing error
          router.replace('/sign-in?error=missing_code');
          return;
        }

        console.log('[AUTH DEBUG] OAuth callback: Exchanging code for session...');
        console.log('[AUTH DEBUG] OAuth callback: Code length:', code.length);
        
        const { data, error: exchangeError } = await sb.auth.exchangeCodeForSession({ queryParams: qs });

        console.log('[AUTH DEBUG] OAuth callback: Exchange result:', { 
          hasData: !!data, 
          hasSession: !!data?.session,
          userId: data?.session?.user?.id,
          userEmail: data?.session?.user?.email,
          sessionExpiresAt: data?.session?.expires_at,
          error: exchangeError?.message,
          errorStatus: exchangeError?.status,
          timestamp: new Date().toISOString()
        });

        // scrub params to avoid accidental re-exchange on refresh
        try {
          const url = new URL(window.location.href);
          url.search = "";
          url.hash = "";
          window.history.replaceState({}, "", url.toString());
          console.log('[AUTH DEBUG] OAuth callback: Scrubbed URL params');
        } catch (error) {
          console.error('[AUTH DEBUG] OAuth callback: Error scrubbing URL:', error);
        }

        if (exchangeError) {
          console.error('[AUTH DEBUG] OAuth callback: Exchange failed:', {
            error: exchangeError.message,
            status: exchangeError.status,
            name: exchangeError.name,
            timestamp: new Date().toISOString()
          });
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        console.log('[AUTH DEBUG] OAuth callback: Getting session after exchange...');
        const { data: { session }, error: sessionError } = await sb.auth.getSession();
        
        console.log('[AUTH DEBUG] OAuth callback: Session check result:', {
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          sessionError: sessionError?.message,
          timestamp: new Date().toISOString()
        });
        
        if (!session) {
          console.error('[AUTH DEBUG] OAuth callback: No session after exchange');
          router.replace('/sign-in?error=no_session');
          return;
        }

        console.log('[AUTH DEBUG] OAuth callback: OAuth callback successful, checking venues...');
        
        // Check if user has venues
        const { data: venues, error: venuesError } = await sb
          .from('venues')
          .select('venue_id')
          .eq('owner_id', session.user.id)
          .limit(1);

        console.log('[AUTH DEBUG] OAuth callback: Venues check result:', {
          hasVenues: !!venues,
          venueCount: venues?.length || 0,
          firstVenueId: venues?.[0]?.venue_id,
          venuesError: venuesError?.message,
          userId: session.user.id,
          timestamp: new Date().toISOString()
        });

        if (venues && venues.length > 0) {
          // User has venues, redirect to their first venue
          console.log('[AUTH DEBUG] OAuth callback: User has venues, redirecting to:', venues[0].venue_id);
          router.replace(`/dashboard/${venues[0].venue_id}`);
        } else {
          // User has no venues, redirect to complete profile
          console.log('[AUTH DEBUG] OAuth callback: User has no venues, redirecting to complete profile');
          router.replace('/complete-profile');
        }

      } catch (err: any) {
        console.error('[AUTH DEBUG] OAuth callback: OAuth callback error:', {
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        });
        router.replace('/sign-in?error=oauth_error');
      }
    })().finally(() => { finished = true; });
  }, [router, sp]);

  // Show loading state while processing
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Finalizing your sign-in...</p>
      </div>
    </div>
  );
}
