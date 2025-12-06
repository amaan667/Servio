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
  const [checkingAuth, setCheckingAuth] = useState(true);
  const hasRedirected = useRef(false);
  const retryCount = useRef(0);
  const maxRetries = 3; // Try refreshing session up to 3 times
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending timeouts
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }

    const checkAuth = async () => {
      // Don't redirect if already redirected
      if (hasRedirected.current) {
        return;
      }

      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      // If we have a user, we're authenticated
      if (user) {
        setCheckingAuth(false);
        retryCount.current = 0; // Reset retry count on success
        hasRedirected.current = false; // Reset redirect flag
        return;
      }

      // If we have a session but no user yet, wait for state to sync
      // This can happen when session is refreshing
      if (session && !user) {
        // Give it a moment for user state to update from session
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
        
        try {
          const supabase = supabaseBrowser();
          // Try to get/refresh the session - this will refresh expired tokens
          const { data: { session: refreshedSession }, error } = await supabase.auth.getSession();
          
          if (refreshedSession && !error && refreshedSession.user) {
            // Session refreshed successfully - wait for AuthProvider to update state
            // The AuthProvider will pick up the refreshed session via onAuthStateChange
            checkTimeoutRef.current = setTimeout(() => {
              if (!hasRedirected.current) {
                checkAuth();
              }
            }, 300);
            return;
          }
        } catch (error) {
          // If refresh fails, continue to redirect after all retries
          console.error("[AUTH REDIRECT] Session refresh attempt failed:", error);
        }
      }

      // After all retries, if still no user, redirect
      // Only redirect if we've exhausted all retry attempts
      if (!user && !session && retryCount.current >= maxRetries && !hasRedirected.current) {
        hasRedirected.current = true;
        setCheckingAuth(false);
        // Small delay to prevent race conditions
        checkTimeoutRef.current = setTimeout(() => {
          router.push("/select-plan");
        }, 100);
        return;
      }

      // Still checking - keep loading state
      if (!user && retryCount.current < maxRetries) {
        setCheckingAuth(true);
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
    }
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: authLoading || checkingAuth,
  };
}

