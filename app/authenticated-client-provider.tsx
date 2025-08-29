'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

function now() {
  return new Date().toISOString();
}

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
      // Only update if the session actually changed
      if (prevSession?.user?.id !== newSession?.user?.id) {
        console.log('[AUTH DEBUG] provider:session:changed', { 
          t: now(), 
          oldUserId: prevSession?.user?.id, 
          newUserId: newSession?.user?.id 
        });
        return newSession;
      }
      return prevSession;
    });
  }, []);

  // Universal session validation - NO automatic restoration
  const validateAndUpdateSession = useCallback(async (session: Session | null) => {
    if (!session) {
      updateSession(null);
      return;
    }

    // Check if session has required fields
    if (!session.user?.id || !session.access_token) {
      console.log('[AUTH DEBUG] provider:invalid session detected', {
        hasUser: !!session.user,
        hasUserId: !!session.user?.id,
        hasAccessToken: !!session.access_token,
        timestamp: now()
      });
      updateSession(null);
      return;
    }

    // Check if session is expired
    if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
      console.log('[AUTH DEBUG] provider:expired session detected', {
        expiresAt: session.expires_at,
        currentTime: Math.floor(Date.now() / 1000),
        timestamp: now()
      });
      updateSession(null);
      return;
    }

    updateSession(session);
  }, [updateSession]);

  // Universal session clearing
  const clearSession = useCallback(() => {
    console.log('[AUTH DEBUG] provider:clearing session');
    setSession(null);
    
    // Clear all authentication-related storage
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
      
      console.log('[AUTH DEBUG] provider:cleared storage keys', {
        localStorage: localStorageKeys,
        sessionStorage: sessionStorageKeys
      });
    }
  }, []);

  // Universal sign out function
  const signOut = useCallback(async () => {
    try {
      console.log('[AUTH DEBUG] provider:signing out');
      await createClient().auth.signOut({ scope: 'global' });
      clearSession();
      console.log('[AUTH DEBUG] provider:sign out successful');
    } catch (error) {
      console.error('[AUTH DEBUG] provider:sign out error', error);
      // Force clear session even if sign out fails
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    console.log('[AUTH DEBUG] provider:mount', { t: now() });

    // NO automatic session restoration - users must sign in explicitly
    const initializeAuth = async () => {
      try {
        console.log('[AUTH DEBUG] provider:initializing auth (NO auto restoration)');
        
        // Only check for session if we're in an OAuth callback
        const isOAuthCallback = window.location.pathname.includes('/auth/callback') || 
                               window.location.search.includes('code=');
        
        if (isOAuthCallback) {
          console.log('[AUTH DEBUG] provider:OAuth callback detected, checking session');
          const { data: { session }, error } = await createClient().auth.getSession();
          console.log('[AUTH DEBUG] provider:OAuth session check', { t: now(), hasSession: !!session, userId: session?.user?.id, err: error?.message });
          
          if (error) {
            console.log('[AUTH DEBUG] provider:OAuth session error, clearing session');
            await validateAndUpdateSession(null);
          } else {
            await validateAndUpdateSession(session);
          }
        } else {
          console.log('[AUTH DEBUG] provider:Not in OAuth callback, no session restoration');
          // Don't restore any session - user must sign in explicitly
          setSession(null);
        }
      } catch (err: any) {
        console.log('[AUTH DEBUG] provider:initialization error', { t: now(), message: err?.message });
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = createClient().auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[AUTH DEBUG] provider:onAuthStateChange', { t: now(), event, hasSession: !!session, userId: session?.user?.id });
      
      // Handle specific auth events
      if (event === 'SIGNED_OUT') {
        clearSession();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await validateAndUpdateSession(session);
      } else {
        await validateAndUpdateSession(session);
      }
      
      setLoading(false);
    });

    return () => {
      console.log('[AUTH DEBUG] provider:unmount', { t: now() });
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
