"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/app/order/utils/safeStorage";
import { useMobileSessionRefresh } from "@/hooks/useMobileSessionRefresh";

interface ExtendedSession extends Session {
  primaryVenue?: {
    venueId: string;
    role: string;
  };
}

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  primaryVenueId: string | null;
  userRole: string | null;
};

const AuthCtx = createContext<AuthValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {
    /* Empty */
  },
  primaryVenueId: null,
  userRole: null,
});

export function useAuth() {
  return useContext(AuthCtx);
}

export default function AuthProvider({
  initialSession,
  children,
}: {
  initialSession: Session | null;
  children: React.ReactNode;
}) {
  // Get initial session from server OR from stored auth
  const getInitialSession = () => {
    if (initialSession) return initialSession;

    // Check for stored session to prevent flicker
    if (typeof window !== "undefined") {
      try {
        const stored = safeGetItem(localStorage, "sb-auth-session");
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed;
        }
      } catch {
        // Ignore parse errors
      }
    }
    return null;
  };

  const initialSessionState = getInitialSession();

  // Use initialSession directly - this is set on server, prevents flicker
  // IMPORTANT: Set state from initialSession immediately, no conditional checks
  const [session, setSession] = useState<Session | null>(initialSessionState);
  const [user, setUser] = useState<User | null>(initialSessionState?.user ?? null);
  // Never show loading if we have initialSession - prevents flicker
  const [loading, setLoading] = useState(false);

  // Extract venue data from initial session and cache it immediately
  const getInitialVenueData = () => {
    const sessionWithVenue = initialSessionState as ExtendedSession;
    if (sessionWithVenue?.primaryVenue) {
      return {
        primaryVenueId: sessionWithVenue.primaryVenue.venueId,
        userRole: sessionWithVenue.primaryVenue.role,
      };
    }

    // Fallback to cache
    if (typeof window !== "undefined" && initialSessionState?.user?.id) {
      const cachedRole = safeGetItem(localStorage, `user_role_${initialSessionState.user.id}`);
      const cachedVenueId = safeGetItem(localStorage, `venue_id_${initialSessionState.user.id}`);
      if (cachedVenueId && cachedRole) {
        return { primaryVenueId: cachedVenueId, userRole: cachedRole };
      }
    }

    return { primaryVenueId: null, userRole: null };
  };

  const initialVenueData = getInitialVenueData();
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(
    initialVenueData.primaryVenueId
  );
  const [userRole, setUserRole] = useState<string | null>(initialVenueData.userRole);

  const cacheVenueData = (userId: string, venueId: string, role: string) => {
    setPrimaryVenueId(venueId);
    setUserRole(role);

    if (typeof window !== "undefined" && userId) {
      safeSetItem(localStorage, `user_role_${userId}`, role);
      safeSetItem(localStorage, `venue_id_${userId}`, venueId);
    }
  };

  const resolveVenueData = async (currentUser: User) => {
    if (typeof window === "undefined") return;

    const cachedRole = safeGetItem(localStorage, `user_role_${currentUser.id}`);
    const cachedVenueId = safeGetItem(localStorage, `venue_id_${currentUser.id}`);
    if (cachedVenueId && cachedRole) {
      setPrimaryVenueId(cachedVenueId);
      setUserRole(cachedRole);
      return;
    }

    try {
      const supabase = supabaseBrowser();

      const { data: ownerVenue } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", currentUser.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (ownerVenue?.venue_id) {
        cacheVenueData(currentUser.id, ownerVenue.venue_id as string, "owner");
        return;
      }

      const { data: staffVenue } = await supabase
        .from("user_venue_roles")
        .select("venue_id, role")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (staffVenue?.venue_id && staffVenue.role) {
        cacheVenueData(currentUser.id, staffVenue.venue_id as string, staffVenue.role);
      }
    } catch {
      // Silent fallback - navigation will still render without a venue
    }
  };

  useEffect(() => {
    // If we have initialSession from server, use it immediately and skip client fetch
    if (initialSession) {
      // Ensure state is set (in case of hydration mismatch)
      if (session !== initialSession) {
        setSession(initialSession);
      }
      if (user !== initialSession.user) {
        setUser(initialSession.user);
      }

      // Set venue data from server session
      const sessionWithVenue = initialSession as ExtendedSession;
      if (sessionWithVenue.primaryVenue) {
        if (initialSession.user?.id) {
          cacheVenueData(
            initialSession.user.id,
            sessionWithVenue.primaryVenue.venueId,
            sessionWithVenue.primaryVenue.role
          );
        } else {
          setPrimaryVenueId(sessionWithVenue.primaryVenue.venueId);
          setUserRole(sessionWithVenue.primaryVenue.role);
        }
      } else if (initialSession.user) {
        resolveVenueData(initialSession.user);
      }

      setLoading(false);

      // Still set up auth state change listener for future updates
      let supabase;
      try {
        supabase = supabaseBrowser();
      } catch {
        return;
      }

      // Set up auth state change listener
      let subscription: { unsubscribe: () => void } | undefined;
      try {
        const { data } = supabase.auth.onAuthStateChange(
          async (event: unknown, newSession: unknown) => {
            switch (event) {
              case "SIGNED_IN":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                if (typeof window !== "undefined" && newSession) {
                  safeSetItem(localStorage, "sb-auth-session", JSON.stringify(newSession));
                }
                if ((newSession as Session | null)?.user) {
                  resolveVenueData((newSession as Session).user);
                }
                setLoading(false);
                break;
              case "SIGNED_OUT":
                setSession(null);
                setUser(null);
                if (typeof window !== "undefined") {
                  safeRemoveItem(localStorage, "sb-auth-session");
                }
                setLoading(false);
                break;
              case "TOKEN_REFRESHED":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                if (typeof window !== "undefined" && newSession) {
                  safeSetItem(localStorage, "sb-auth-session", JSON.stringify(newSession));
                }
                if ((newSession as Session | null)?.user && !primaryVenueId) {
                  resolveVenueData((newSession as Session).user);
                }
                break;
              case "USER_UPDATED":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                break;
              default:
                if (newSession) {
                  setSession(newSession as Session | null);
                  setUser((newSession as { user?: User } | null)?.user ?? null);
                }
                setLoading(false);
            }
          }
        );
        subscription = data?.subscription;
      } catch {
        setLoading(false);
      }

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }

    // No initialSession - fetch on client (only if no initialSession provided)
    if (!initialSession) {
      let supabase: ReturnType<typeof supabaseBrowser>;
      try {
        supabase = supabaseBrowser();
      } catch {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // Fetch session from client
      const getInitialSession = async () => {
        setLoading(true);
        try {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          setSession(currentSession);
          setUser(currentSession?.user || null);
          if (currentSession?.user) {
            resolveVenueData(currentSession.user);
          }
        } catch (error) {
          setSession(null);
          setUser(null);
        } finally {
          setLoading(false);
        }
      };

      getInitialSession();

      // Handle auth state changes for client-fetched sessions
      let subscription: { unsubscribe: () => void } | undefined;
      try {
        const { data } = supabase.auth.onAuthStateChange(
          async (event: unknown, newSession: unknown) => {
            switch (event) {
              case "SIGNED_IN":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                // Store session to prevent flicker on reload
                if (typeof window !== "undefined" && newSession) {
                  safeSetItem(localStorage, "sb-auth-session", JSON.stringify(newSession));
                }
                if ((newSession as Session | null)?.user) {
                  resolveVenueData((newSession as Session).user);
                }
                setLoading(false);
                break;
              case "SIGNED_OUT":
                setSession(null);
                setUser(null);
                // Clear stored session
                if (typeof window !== "undefined") {
                  safeRemoveItem(localStorage, "sb-auth-session");
                }
                setLoading(false);
                break;
              case "TOKEN_REFRESHED":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                // Update stored session
                if (typeof window !== "undefined" && newSession) {
                  safeSetItem(localStorage, "sb-auth-session", JSON.stringify(newSession));
                }
                if ((newSession as Session | null)?.user && !primaryVenueId) {
                  resolveVenueData((newSession as Session).user);
                }
                break;
              case "USER_UPDATED":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                break;
              default:
                if (newSession) {
                  setSession(newSession as Session | null);
                  setUser((newSession as { user?: User } | null)?.user ?? null);
                }
                setLoading(false);
            }
          }
        );
        subscription = data?.subscription;
      } catch {
        setLoading(false);
      }

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [initialSession]);

  const handleSessionRefreshed = useCallback((refreshedSession: Session) => {
    setSession(refreshedSession);
    setUser(refreshedSession.user);
    if (typeof window !== "undefined") {
      safeSetItem(localStorage, "sb-auth-session", JSON.stringify(refreshedSession));
    }
  }, []);

  const handleSessionExpired = useCallback(() => {
    setSession(null);
    setUser(null);
    setPrimaryVenueId(null);
    setUserRole(null);
    if (typeof window !== "undefined") {
      safeRemoveItem(localStorage, "sb-auth-session");
    }
  }, []);

  useMobileSessionRefresh({
    session,
    onSessionRefreshed: handleSessionRefreshed,
    onSessionExpired: handleSessionExpired,
  });

  const signOut = async () => {
    // Store user ID before clearing session (needed for cleanup)
    const userId = session?.user?.id;

    // CRITICAL: Clear local state FIRST to prevent UI from showing stale data
    setSession(null);
    setUser(null);
    setPrimaryVenueId(null);
    setUserRole(null);

    // CRITICAL: Clear the sb-auth-session from localStorage FIRST
    // This prevents getInitialSession() from restoring stale session on page reload
    if (typeof window !== "undefined") {
      // Clear the cached session that getInitialSession() reads
      safeRemoveItem(localStorage, "sb-auth-session");

      // Clear user-specific cached data
      if (userId) {
        safeRemoveItem(localStorage, `user_role_${userId}`);
        safeRemoveItem(localStorage, `venue_id_${userId}`);
      }

      // Clear all user role/venue caches from localStorage
      const localKeys = Object.keys(localStorage);
      localKeys.forEach((key) => {
        if (
          key.startsWith("user_role_") ||
          key.startsWith("venue_id_") ||
          key.startsWith("dashboard_user_") ||
          key.startsWith("dashboard_venue_")
        ) {
          safeRemoveItem(localStorage, key);
        }
      });

      // Clear sessionStorage caches
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach((key) => {
        if (
          key.startsWith("user_role_") ||
          key.startsWith("venue_id_") ||
          key.startsWith("dashboard_user_") ||
          key.startsWith("dashboard_venue_")
        ) {
          safeRemoveItem(sessionStorage, key);
        }
      });
    }

    try {
      // Call Supabase signOut to clear cookies and server session
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();
    } catch {
      // Even if Supabase signOut fails, local state is already cleared
      // The user will be signed out from this device
    }
  };

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      signOut,
      primaryVenueId,
      userRole,
    }),
    [session, user, loading, primaryVenueId, userRole]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
