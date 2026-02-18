"use client";

import { useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";

/**
 * Proactively refreshes the Supabase session when a mobile browser tab
 * returns from the background.
 *
 * Mobile browsers aggressively suspend inactive tabs — all JS timers stop,
 * which means Supabase's built-in `autoRefreshToken` never fires. The access
 * token (1 h TTL) expires while the tab sleeps, so the very first request
 * after the user returns hits the middleware with a stale cookie and fails.
 *
 * This hook listens for the `visibilitychange` event and, when the page
 * becomes visible again after a meaningful pause (> 30 s), it:
 *   1. Calls `refreshSession()` to get fresh tokens from Supabase Auth.
 *   2. POSTs the new tokens to `/api/auth/set-session` so the server-side
 *      middleware cookies are also updated.
 *   3. Fires `onSessionRefreshed` so the AuthProvider can update React state.
 *   4. If the refresh token itself has expired, calls `onSessionExpired` so
 *      the app can sign the user out gracefully.
 */
export function useMobileSessionRefresh({
  session,
  onSessionRefreshed,
  onSessionExpired,
}: {
  session: Session | null;
  onSessionRefreshed: (session: Session) => void;
  onSessionExpired: () => void;
}) {
  const lastVisibleAt = useRef(Date.now());
  const isRefreshing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const STALE_THRESHOLD_MS = 30_000;

    async function syncCookies(s: Session) {
      try {
        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s.access_token}`,
          },
          body: JSON.stringify({
            access_token: s.access_token,
            refresh_token: s.refresh_token,
          }),
          credentials: "include",
        });
      } catch {
        // Best-effort — the client still has fresh tokens in memory/storage.
      }
    }

    async function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        lastVisibleAt.current = Date.now();
        return;
      }

      if (!session) return;

      const elapsed = Date.now() - lastVisibleAt.current;
      if (elapsed < STALE_THRESHOLD_MS) return;
      if (isRefreshing.current) return;

      isRefreshing.current = true;

      try {
        const supabase = supabaseBrowser();

        const { data, error } = await supabase.auth.refreshSession();

        if (error || !data.session) {
          const msg = error?.message ?? "";
          const isExpired =
            msg.includes("refresh_token_not_found") ||
            msg.includes("Invalid Refresh Token") ||
            msg.includes("invalid_grant");

          if (isExpired) {
            onSessionExpired();
          }
          return;
        }

        await syncCookies(data.session);
        onSessionRefreshed(data.session);
      } catch {
        // Network error — leave current state alone, will retry next visibility change.
      } finally {
        isRefreshing.current = false;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, onSessionRefreshed, onSessionExpired]);
}
