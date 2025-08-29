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
          newUserId: newSession?.user?.id,
          oldUserEmail: prevSession?.user?.email,
          newUserEmail: newSession?.user?.email
        });
        return newSession;
      }
      return prevSession;
    });
  }, []);

  // Universal session validation - NO automatic restoration
  const validateAndUpdateSession = useCallback(async (session: Session | null) => {
    console.log('[AUTH DEBUG] provider:validating session:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      hasAccessToken: !!session?.access_token,
      expiresAt: session?.expires_at,
      timestamp: now()
    });

    if (!session) {
      console.log('[AUTH DEBUG] provider:no session provided, clearing');
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

    console.log('[AUTH DEBUG] provider:session validation passed, updating');
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
      
      // Clear session and storage first to prevent auth state change errors
      clearSession();
      
      // Use server-side sign out to clear cookies
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.log('[AUTH DEBUG] provider:server-side sign out failed');
      } else {
        console.log('[AUTH DEBUG] provider:server-side sign out successful');
      }
    } catch (error) {
      console.error('[AUTH DEBUG] provider:sign out error', error);
      // Even if server-side sign out fails, we've already cleared the session
    }
  }, [clearSession]);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      console.log('[AUTH DEBUG] provider:server side, skipping initialization');
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
        
        console.log('[AUTH DEBUG] provider:checking if OAuth callback:', {
          pathname: window.location.pathname,
          search: window.location.search,
          isOAuthCallback,
          timestamp: now()
        });
        
        if (isOAuthCallback) {
          console.log('[AUTH DEBUG] provider:OAuth callback detected, checking session');
          const { data: { session }, error } = await createClient().auth.getSession();
          console.log('[AUTH DEBUG] provider:OAuth session check', { 
            t: now(), 
            hasSession: !!session, 
            userId: session?.user?.id,
            userEmail: session?.user?.email,
            err: error?.message 
          });
          
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
        console.log('[AUTH DEBUG] provider:initialization error', { 
          t: now(), 
          message: err?.message,
          stack: err?.stack 
        });
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = createClient().auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[AUTH DEBUG] provider:onAuthStateChange', { 
        t: now(), 
        event, 
        hasSession: !!session, 
        userId: session?.user?.id,
        userEmail: session?.user?.email 
      });
      
      try {
        // Handle specific auth events
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH DEBUG] provider:auth state change - SIGNED_OUT');
          clearSession();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('[AUTH DEBUG] provider:auth state change - SIGNED_IN/TOKEN_REFRESHED');
          await validateAndUpdateSession(session);
        } else {
          console.log('[AUTH DEBUG] provider:auth state change - other event:', event);
          await validateAndUpdateSession(session);
        }
      } catch (error) {
        console.error('[AUTH DEBUG] provider:auth state change error', error);
        // Don't let auth state change errors crash the app
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
