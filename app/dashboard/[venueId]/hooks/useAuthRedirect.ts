import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase";

/**
 * Hook to check authentication and redirect non-authenticated users to /select-plan
 * Use this in all dashboard page client components
 *
 * FIX: Wait for session refresh before redirecting to prevent signing out users
 * who have valid sessions but need token refresh after being away for a long time
 */
export function useAuthRedirect() {
  const { user, loading: authLoading, session } = useAuth();
  const router = useRouter();
  // CRITICAL: Start with false to allow immediate rendering
  // Only set to true if we actually need to check auth
  const [checkingAuth, setCheckingAuth] = useState(false);
  const hasRedirected = useRef(false);
  const retryCount = useRef(0);
  const maxRetries = 3; // Try refreshing session up to 3 times
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkStartTime = useRef<number | null>(null);
  const maxCheckTime = 10000; // 10 seconds max

  useEffect(() => {
    // Clear any pending timeouts
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }

    const checkAuth = async () => {
      // Track when we started checking
      if (!checkStartTime.current) {
        checkStartTime.current = Date.now();
      }

      const elapsed = Date.now() - (checkStartTime.current || 0);

      // Timeout: If we've been checking for too long, stop blocking
      if (elapsed > maxCheckTime) {
        setCheckingAuth(false);
        return;
      }

      // Don't redirect if already redirected
      if (hasRedirected.current) {
        setCheckingAuth(false);
        return;
      }

      // If we have a user, we're authenticated - stop checking immediately
      if (user) {
        setCheckingAuth(false);
        retryCount.current = 0; // Reset retry count on success
        hasRedirected.current = false; // Reset redirect flag
        checkStartTime.current = null;
        return;
      }

      // If we have a session, we're likely authenticated - don't block
      if (session?.user) {
        setCheckingAuth(false);
        return;
      }

      // Wait for auth to finish loading, but with timeout
      if (authLoading) {
        // If auth has been loading for more than 5 seconds, proceed anyway
        if (elapsed > 5000) {
          setCheckingAuth(false);
          return;
        }
        setCheckingAuth(true);
        return;
      }

      // If we have a session but no user yet, wait for state to sync
      // This can happen when session is refreshing
      if (session && !user) {
        // Give it a moment for user state to update from session, but don't block
        setCheckingAuth(false);
        checkTimeoutRef.current = setTimeout(() => {
          if (!hasRedirected.current && !user) {
            checkAuth();
          }
        }, 200);
        return;
      }

      // No user and no session - try to refresh session first
      // This handles the case where user has been away and token needs refresh
      if (!user && !session && retryCount.current < maxRetries) {
        retryCount.current += 1;

        setCheckingAuth(true);

        try {
          const supabase = supabaseBrowser();
          // Try to get/refresh the session - this will refresh expired tokens
          const {
            data: { session: refreshedSession },
            error,
          } = await supabase.auth.getSession();

          if (refreshedSession && !error && refreshedSession.user) {
            // Session refreshed successfully - wait for AuthProvider to update state
            // The AuthProvider will pick up the refreshed session via onAuthStateChange
            setCheckingAuth(false);
            checkTimeoutRef.current = setTimeout(() => {
              if (!hasRedirected.current) {
                checkAuth();
              }
            }, 300);
            return;
          }
        } catch (error) {
          // If refresh fails, continue to redirect after all retries
        }

        // Timeout per retry attempt (2 seconds)
        if (elapsed > 2000 * retryCount.current) {
          setCheckingAuth(false);
        }
      }

      // After all retries, if still no user, redirect
      // Only redirect if we've exhausted all retry attempts
      if (!user && !session && retryCount.current >= maxRetries && !hasRedirected.current) {
        hasRedirected.current = true;
        setCheckingAuth(false);
        checkStartTime.current = null;
        // Small delay to prevent race conditions
        checkTimeoutRef.current = setTimeout(() => {
          router.push("/select-plan");
        }, 100);
        return;
      }

      // Don't keep checking if we've been at it too long
      if (elapsed > maxCheckTime) {
        setCheckingAuth(false);
        return;
      }

      // Only set checking to true if we're actively retrying
      if (!user && retryCount.current < maxRetries && elapsed < maxCheckTime) {
        setCheckingAuth(true);
      } else {
        setCheckingAuth(false);
      }
    };

    checkAuth();

    // Cleanup timeout on unmount
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [user, authLoading, router, session]);

  // Reset redirect flag if user appears (session refreshed successfully)
  useEffect(() => {
    if (user) {
      hasRedirected.current = false;
      retryCount.current = 0;
      setCheckingAuth(false);
      checkStartTime.current = null;
    }
  }, [user]);

  // Don't block if we have a session even without user (user state may be updating)
  const isLoading = (authLoading || checkingAuth) && !user && !session;

  return {
    user,

    isLoading,
  };
}
