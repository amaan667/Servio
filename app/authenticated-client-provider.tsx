'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  session: null, 
  loading: true,
  signOut: async () => {}
});

export function AuthenticatedClientProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const updateSession = useCallback((newSession: Session | null) => {
    setSession(prevSession => {
      if (prevSession?.user?.id !== newSession?.user?.id) {
        console.log('[AUTH DEBUG] Session changed:', { 
          oldUserId: prevSession?.user?.id, 
          newUserId: newSession?.user?.id 
        });
        return newSession;
      }
      return prevSession;
    });
  }, []);

  const validateAndUpdateSession = useCallback(async (session: Session | null) => {
    if (!session) {
      updateSession(null);
      return;
    }

    // Check if session has required fields
    if (!session.user?.id || !session.access_token) {
      console.log('[AUTH DEBUG] Invalid session detected');
      updateSession(null);
      return;
    }

    // Check if session is expired
    if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
      console.log('[AUTH DEBUG] Expired session detected');
      updateSession(null);
      return;
    }

    updateSession(session);
  }, [updateSession]);

  const clearSession = useCallback(() => {
    console.log('[AUTH DEBUG] Clearing session');
    setSession(null);
    
    if (typeof window !== 'undefined') {
      // Clear OAuth progress flags
      sessionStorage.removeItem("sb_oauth_in_progress");
      sessionStorage.removeItem("sb_oauth_start_time");
      
      // Clear all Supabase-related storage
      const localStorageKeys = Object.keys(localStorage).filter(k => 
        k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
      );
      localStorageKeys.forEach(k => localStorage.removeItem(k));
      
      const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
        k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
      );
      sessionStorageKeys.forEach(k => sessionStorage.removeItem(k));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      console.log('[AUTH DEBUG] Signing out');
      clearSession();
      
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.log('[AUTH DEBUG] Server-side sign out failed');
      }
    } catch (error) {
      console.error('[AUTH DEBUG] Sign out error', error);
    }
  }, [clearSession]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    console.log('[AUTH DEBUG] Initializing auth provider');

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await createClient().auth.getSession();
        
        if (error) {
          console.log('[AUTH DEBUG] Session check error:', error.message);
          await validateAndUpdateSession(null);
        } else {
          await validateAndUpdateSession(session);
        }
      } catch (err: any) {
        console.log('[AUTH DEBUG] Initialization error:', err?.message);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = createClient().auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[AUTH DEBUG] Auth state change:', { event, hasSession: !!session });
      
      try {
        if (event === 'SIGNED_OUT') {
          clearSession();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await validateAndUpdateSession(session);
        } else {
          await validateAndUpdateSession(session);
        }
      } catch (error) {
        console.error('[AUTH DEBUG] Auth state change error', error);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [validateAndUpdateSession, clearSession]);

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
