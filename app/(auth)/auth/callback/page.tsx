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
        
        // Try to read from ?query and fallback to #hash if needed
        let qs = new URLSearchParams(window.location.search);
        if (!qs.get("code") && window.location.hash?.includes("code=")) {
          qs = new URLSearchParams(window.location.hash.slice(1));
        }

        // Debug log
        console.log("[AUTH DEBUG] callback URL", {
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          codePresent: !!qs.get("code"),
        });

        const code = qs.get("code");
        const err = qs.get("error");

        if (err) {
          console.error('[AUTH DEBUG] OAuth error in callback:', err);
          router.replace('/sign-in?error=oauth_error');
          return;
        }

        if (!code) {
          console.error('[AUTH DEBUG] No authorization code in callback - redirecting to sign-in');
          // Redirect to sign-in page instead of showing error
          router.replace('/sign-in?error=missing_code');
          return;
        }

        console.log('[AUTH DEBUG] Exchanging code for session...');
        const { data, error: exchangeError } = await sb.auth.exchangeCodeForSession({ queryParams: qs });

        console.log('[AUTH DEBUG] Exchange result:', { 
          hasData: !!data, 
          hasSession: !!data?.session,
          userId: data?.session?.user?.id,
          error: exchangeError?.message 
        });

        // scrub params to avoid accidental re-exchange on refresh
        try {
          const url = new URL(window.location.href);
          url.search = "";
          url.hash = "";
          window.history.replaceState({}, "", url.toString());
        } catch {}

        if (exchangeError) {
          console.error('[AUTH DEBUG] Exchange failed:', exchangeError);
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
          console.error('[AUTH DEBUG] No session after exchange');
          router.replace('/sign-in?error=no_session');
          return;
        }

        console.log('[AUTH DEBUG] OAuth callback successful, checking venues...');
        
        // Check if user has venues
        const { data: venues } = await sb
          .from('venues')
          .select('venue_id')
          .eq('owner_id', session.user.id)
          .limit(1);

        if (venues && venues.length > 0) {
          // User has venues, redirect to their first venue
          console.log('[AUTH DEBUG] User has venues, redirecting to:', venues[0].venue_id);
          router.replace(`/dashboard/${venues[0].venue_id}`);
        } else {
          // User has no venues, redirect to complete profile
          console.log('[AUTH DEBUG] User has no venues, redirecting to complete profile');
          router.replace('/complete-profile');
        }

      } catch (err: any) {
        console.error('[AUTH DEBUG] OAuth callback error:', err);
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
