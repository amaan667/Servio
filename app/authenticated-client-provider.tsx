"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/sb-client";

// Create a context for authenticated state
export interface AuthState {
  session: any;
  isLoading: boolean;
  user: any;
}

const AuthContext = createContext<AuthState>({
  session: null,
  isLoading: true,
  user: null
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export function AuthenticatedClientProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    isLoading: true,
    user: null
  });

  useEffect(() => {
    // Function to fetch session
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setAuthState({
          session,
          isLoading: false,
          user: session?.user || null
        });
      } catch (error) {
        console.error("Error fetching session:", error);
        setAuthState({
          session: null,
          isLoading: false,
          user: null
        });
      }
    };

    // Fetch the session initially
    fetchSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("[AUTH_CONTEXT] Auth state changed:", _event, !!session);
        setAuthState({
          session,
          isLoading: false,
          user: session?.user || null
        });
      }
    );

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
}
