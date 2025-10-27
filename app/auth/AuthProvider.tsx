"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {
    /* Empty */
  },
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

  const [session, setSession] = useState<Session | null>(getInitialSession());
  const [user, setUser] = useState<User | null>(getInitialSession()?.user ?? null);
  // Start with loading=false since we have initialSession from server
  // Only set loading=true if we need to fetch session on client
  const [loading, setLoading] = useState(!initialSession); // Only load if no initial session

  useEffect(() => {
    let supabase;
    try {
      supabase = supabaseBrowser();
    } catch {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    // Get initial session quickly - only if we don't have one already
    const getInitialSession = async () => {
      if (initialSession) {
        // Already have session from server, no need to fetch
        setLoading(false);
        return;
      }

      // No initial session, fetch on client
      setLoading(true);
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user || null);
      } catch {
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Get initial session immediately
    getInitialSession();

    // Handle auth state changes
    let subscription: unknown;
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
        (subscription as any).unsubscribe();
      }
    };
  }, [initialSession]);

  const signOut = async () => {
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();

      // Clear local state immediately
      setSession(null);
      setUser(null);
    } catch {
      // Clear local state even if there's an error
      setSession(null);
      setUser(null);
    }
  };

  const value = useMemo(() => ({ session, user, loading, signOut }), [session, user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
