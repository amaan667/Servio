'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
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
    console.log('[AUTH PROVIDER] Updating session:', {
      hasNewSession: !!newSession,
      newUserId: newSession?.user?.id,
      hasAccessToken: !!newSession?.access_token,
      expiresAt: newSession?.expires_at
    });
    
    setSession(prevSession => {
      if (prevSession?.user?.id !== newSession?.user?.id) {
        return newSession;
      }
      return prevSession;
    });
  }, []);

  const validateAndUpdateSession = useCallback(async (session: Session | null) => {
    console.log('[AUTH PROVIDER] Validating session:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasAccessToken: !!session?.access_token,
      expiresAt: session?.expires_at
    });

    if (!session) {
      console.log('[AUTH PROVIDER] No session, clearing');
      updateSession(null);
      return;
    }

    // Check if session has required fields
    if (!session.user?.id || !session.access_token) {
      console.log('[AUTH PROVIDER] Session missing required fields, clearing');
      updateSession(null);
      return;
    }

    // Check if session is expired
    if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
      console.log('[AUTH PROVIDER] Session expired, clearing');
      updateSession(null);
      return;
    }

    console.log('[AUTH PROVIDER] Session is valid, updating');
    updateSession(session);
  }, [updateSession]);

  const clearSession = useCallback(() => {
    console.log('[AUTH PROVIDER] Clearing session');
    setSession(null);

    if (typeof window !== 'undefined') {
      // Clear OAuth progress flags
      sessionStorage.removeItem("sb_oauth_in_progress");
      sessionStorage.removeItem("sb_oauth_start_time");

      // Clear all Supabase-related storage
      const localStorageKeys = Object.keys(localStorage).filter(k =>
        k.startsWith("sb-") || k.includes("auth")
      );
      localStorageKeys.forEach(k => localStorage.removeItem(k));

      const sessionStorageKeys = Object.keys(sessionStorage).filter(k =>
        k.startsWith("sb-") || k.includes("auth")
      );
      sessionStorageKeys.forEach(k => sessionStorage.removeItem(k));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      clearSession();
      
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // Silent error handling
    }
  }, [clearSession]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const initializeAuth = async () => {
      console.log('[AUTH PROVIDER] Initializing auth');
      try {
        const { data: { session }, error } = await supabaseBrowser.auth.getSession();

        if (error) {
          console.log('[AUTH PROVIDER] Error getting session:', {
            message: error.message,
            status: error.status,
            code: error.code
          });

          // Handle refresh token error specifically
          if (error.message?.includes('refresh_token_not_found') ||
              error.message?.includes('Invalid Refresh Token') ||
              error.code === 'refresh_token_not_found') {
            console.log('[AUTH PROVIDER] Refresh token not found, clearing auth state');

            // Clear all auth-related storage to prevent repeated attempts
            if (typeof window !== 'undefined') {
              // Clear OAuth progress flags
              sessionStorage.removeItem("sb_oauth_in_progress");
              sessionStorage.removeItem("sb_oauth_start_time");

              // Clear all Supabase-related storage
              const localStorageKeys = Object.keys(localStorage).filter(k =>
                k.startsWith("sb-") || k.includes("auth")
              );
              localStorageKeys.forEach(k => localStorage.removeItem(k));

              const sessionStorageKeys = Object.keys(sessionStorage).filter(k =>
                k.startsWith("sb-") || k.includes("auth")
              );
              sessionStorageKeys.forEach(k => sessionStorage.removeItem(k));

              console.log('[AUTH PROVIDER] Cleared auth storage due to refresh token error');
            }

            await validateAndUpdateSession(null);
          } else if (error.message?.includes('JWT') || error.message?.includes('token')) {
            console.log('[AUTH PROVIDER] Token-related error, clearing session');
            await validateAndUpdateSession(null);
          } else {
            console.log('[AUTH PROVIDER] Unknown session error, clearing session');
            await validateAndUpdateSession(null);
          }
        } else {
          console.log('[AUTH PROVIDER] Got session from storage:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id,
            expiresAt: session?.expires_at,
            expiresIn: session?.expires_at ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000 / 60) + ' minutes' : 'unknown'
          });
          await validateAndUpdateSession(session);
        }
      } catch (err: any) {
        console.log('[AUTH PROVIDER] Exception getting session:', {
          message: err.message,
          stack: err.stack?.substring(0, 200) + '...'
        });
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[AUTH PROVIDER] Auth state change:', event, {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        expiresAt: session?.expires_at
      });

      try {
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH PROVIDER] User signed out, clearing session');
          clearSession();
        } else if (event === 'SIGNED_IN') {
          console.log('[AUTH PROVIDER] User signed in, updating session');
          await validateAndUpdateSession(session);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH PROVIDER] Token refreshed, updating session');
          await validateAndUpdateSession(session);
        } else if (event === 'USER_UPDATED') {
          console.log('[AUTH PROVIDER] User updated, updating session');
          await validateAndUpdateSession(session);
        }
      } catch (error) {
        console.log('[AUTH PROVIDER] Error handling auth state change:', error);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [validateAndUpdateSession, clearSession]);

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthenticatedClientProvider');
  }
  return context;
}
