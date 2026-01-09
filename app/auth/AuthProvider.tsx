"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";

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
        const stored = localStorage.getItem("sb-auth-session");
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

  // Use initialSession directly - this is set on server, prevents flicker
  // IMPORTANT: Set state from initialSession immediately, no conditional checks
  const [session, setSession] = useState<Session | null>(initialSession);
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  // Never show loading if we have initialSession - prevents flicker
  const [loading, setLoading] = useState(false);

  // Extract venue data from initial session and cache it immediately
  const getInitialVenueData = () => {
    const sessionWithVenue = initialSession as ExtendedSession;
    if (sessionWithVenue?.primaryVenue) {
      return {
        primaryVenueId: sessionWithVenue.primaryVenue.venueId,
        userRole: sessionWithVenue.primaryVenue.role
      };
    }

    // Fallback to cache
    if (typeof window !== "undefined" && initialSession?.user?.id) {
      const cachedRole = localStorage.getItem(`user_role_${initialSession.user.id}`);
      const cachedVenueId = localStorage.getItem(`venue_id_${initialSession.user.id}`);
      if (cachedVenueId && cachedRole) {
        return { primaryVenueId: cachedVenueId, userRole: cachedRole };
      }
    }

    return { primaryVenueId: null, userRole: null };
  };

  const initialVenueData = getInitialVenueData();
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(initialVenueData.primaryVenueId);
  const [userRole, setUserRole] = useState<string | null>(initialVenueData.userRole);

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
        setPrimaryVenueId(sessionWithVenue.primaryVenue.venueId);
        setUserRole(sessionWithVenue.primaryVenue.role);

        // Cache in localStorage for future visits
        if (typeof window !== "undefined" && initialSession.user?.id) {
          localStorage.setItem(`user_role_${initialSession.user.id}`, sessionWithVenue.primaryVenue.role);
          localStorage.setItem(`venue_id_${initialSession.user.id}`, sessionWithVenue.primaryVenue.venueId);
        }
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
                  localStorage.setItem("sb-auth-session", JSON.stringify(newSession));
                }
                setLoading(false);
                break;
              case "SIGNED_OUT":
                setSession(null);
                setUser(null);
                if (typeof window !== "undefined") {
                  localStorage.removeItem("sb-auth-session");
                }
                setLoading(false);
                break;
              case "TOKEN_REFRESHED":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                if (typeof window !== "undefined" && newSession) {
                  localStorage.setItem("sb-auth-session", JSON.stringify(newSession));
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
                  localStorage.setItem("sb-auth-session", JSON.stringify(newSession));
                }
                setLoading(false);
                break;
              case "SIGNED_OUT":
                setSession(null);
                setUser(null);
                // Clear stored session
                if (typeof window !== "undefined") {
                  localStorage.removeItem("sb-auth-session");
                }
                setLoading(false);
                break;
              case "TOKEN_REFRESHED":
                setSession(newSession as Session | null);
                setUser((newSession as { user?: User } | null)?.user ?? null);
                // Update stored session
                if (typeof window !== "undefined" && newSession) {
                  localStorage.setItem("sb-auth-session", JSON.stringify(newSession));
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

  const signOut = async () => {
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();

      // Clear local state immediately
      setSession(null);
      setUser(null);

      // Clear all cached user data from localStorage and sessionStorage
      if (typeof window !== "undefined") {
        if (session?.user?.id) {
          localStorage.removeItem(`user_role_${session.user.id}`);
          localStorage.removeItem(`venue_id_${session.user.id}`);
        }
        const sessionKeys = Object.keys(sessionStorage);
        sessionKeys.forEach((key) => {
          if (key.startsWith("user_role_") || key.startsWith("venue_id_")) {
            sessionStorage.removeItem(key);
          }
        });
      }
    } catch {
      // Clear local state even if there's an error
      setSession(null);
      setUser(null);

      // Clear all cached user data from session storage even on error
      if (typeof window !== "undefined") {
        const keys = Object.keys(sessionStorage);
        keys.forEach((key) => {
          if (key.startsWith("user_role_") || key.startsWith("venue_id_")) {
            sessionStorage.removeItem(key);
          }
        });
      }
    }
  };

  const value = useMemo(() => ({
    session,
    user,
    loading,
    signOut,
    primaryVenueId,
    userRole
  }), [session, user, loading, primaryVenueId, userRole]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
