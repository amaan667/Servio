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
      
      // Clear all Supabase-related storage BUT preserve PKCE verifier
      const localStorageKeys = Object.keys(localStorage).filter(k => 
        (k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("auth")
      );
      localStorageKeys.forEach(k => localStorage.removeItem(k));
      
      const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
        (k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("auth")
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
        const { data: { session }, error } = await createClient().auth.getSession();
        
        if (error) {
          console.log('[AUTH PROVIDER] Error getting session:', error);
          
          // Handle refresh token error specifically
          if (error.message?.includes('refresh_token_not_found') || error.code === 'refresh_token_not_found') {
            console.log('[AUTH PROVIDER] Refresh token not found, attempting to refresh session');
            try {
              const { data: refreshData, error: refreshError } = await createClient().auth.refreshSession();
              if (refreshError) {
                console.log('[AUTH PROVIDER] Session refresh failed:', refreshError);
                await validateAndUpdateSession(null);
              } else if (refreshData.session) {
                console.log('[AUTH PROVIDER] Session refreshed successfully');
                await validateAndUpdateSession(refreshData.session);
              } else {
                await validateAndUpdateSession(null);
              }
            } catch (refreshErr) {
              console.log('[AUTH PROVIDER] Session refresh exception:', refreshErr);
              await validateAndUpdateSession(null);
            }
          } else {
            await validateAndUpdateSession(null);
          }
        } else {
          console.log('[AUTH PROVIDER] Got session from storage:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id
          });
          await validateAndUpdateSession(session);
        }
      } catch (err: any) {
        console.log('[AUTH PROVIDER] Exception getting session:', err);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = createClient().auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[AUTH PROVIDER] Auth state change:', event, {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id
      });
      
      try {
        if (event === 'SIGNED_OUT') {
          clearSession();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await validateAndUpdateSession(session);
        } else {
          await validateAndUpdateSession(session);
        }
      } catch (error) {
        console.log('[AUTH PROVIDER] Error handling auth state change:', error);
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
