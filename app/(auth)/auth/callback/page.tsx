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
        // Try to read from ?query and fallback to #hash if needed
        let qs = new URLSearchParams(window.location.search);
        if (!qs.get("code") && window.location.hash?.includes("code=")) {
          qs = new URLSearchParams(window.location.hash.slice(1));
        }

        const code = qs.get("code");
        const err = qs.get("error");

        if (err) {
          router.replace('/?auth_error=oauth_error');
          return;
        }

        if (!code) {
          router.replace('/?auth_error=missing_code');
          return;
        }

        const { data, error: exchangeError } = await sb.auth.exchangeCodeForSession({ queryParams: qs });

        // scrub params to avoid accidental re-exchange on refresh
        try {
          const url = new URL(window.location.href);
          url.search = "";
          url.hash = "";
          window.history.replaceState({}, "", url.toString());
        } catch (error) {
          // Silent error handling
        }

        if (exchangeError) {
          router.replace('/?auth_error=exchange_failed');
          return;
        }

        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
          router.replace('/?auth_error=no_session');
          return;
        }
        
        // Check if user has venues
        const { data: venues } = await sb
          .from('venues')
          .select('venue_id')
          .eq('owner_id', session.user.id)
          .limit(1);

        if (venues && venues.length > 0) {
          router.replace(`/dashboard/${venues[0].venue_id}`);
        } else {
          router.replace('/complete-profile');
        }

      } catch (err: any) {
        router.replace('/?auth_error=oauth_error');
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
