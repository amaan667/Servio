'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabaseBrowser, checkAuthStatus, refreshSession } from '@/lib/supabase/browser';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  session: null, 
  loading: true,
  signOut: async () => {},
  refreshAuth: async () => {}
});

export function AuthenticatedClientProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

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
      console.log('[AUTH PROVIDER] Session expired, attempting refresh');
      
      try {
        const { session: refreshedSession, error } = await refreshSession();
        
        if (error) {
          console.log('[AUTH PROVIDER] Failed to refresh session:', error);
          updateSession(null);
          return;
        }
        
        if (refreshedSession) {
          console.log('[AUTH PROVIDER] Session refreshed successfully');
          updateSession(refreshedSession);
          return;
        } else {
          console.log('[AUTH PROVIDER] No refreshed session returned');
          updateSession(null);
          return;
        }
      } catch (error) {
        console.log('[AUTH PROVIDER] Error refreshing session:', error);
        updateSession(null);
        return;
      }
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
      sessionStorageKeys.forEach(key => sessionStorage.removeItem(key));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      console.log('[AUTH PROVIDER] Signing out...');
      clearSession();
      
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.log('[AUTH PROVIDER] Server signout failed:', response.status);
      } else {
        console.log('[AUTH PROVIDER] Server signout successful');
      }
    } catch (error) {
      console.error('[AUTH PROVIDER] Signout error:', error);
    }
  }, [clearSession]);

  const refreshAuth = useCallback(async () => {
    try {
      console.log('[AUTH PROVIDER] Refreshing auth...');
      const { isAuthenticated, session: currentSession, error } = await checkAuthStatus();
      
      if (error) {
        console.log('[AUTH PROVIDER] Error checking auth status:', error);
        updateSession(null);
        return;
      }
      
      if (isAuthenticated && currentSession) {
        await validateAndUpdateSession(currentSession);
      } else {
        updateSession(null);
      }
    } catch (error) {
      console.error('[AUTH PROVIDER] Error refreshing auth:', error);
      updateSession(null);
    }
  }, [validateAndUpdateSession, updateSession]);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const initializeAuth = async () => {
      console.log('[AUTH PROVIDER] Initializing auth');
      try {
        console.log('[AUTH PROVIDER] Creating Supabase client...');
        let supabase;
        try {
          supabase = supabaseBrowser();
          console.log('[AUTH PROVIDER] Supabase client created successfully');
        } catch (clientError: any) {
          console.log('[AUTH PROVIDER] Error creating Supabase client:', {
            message: clientError.message,
            stack: clientError.stack?.substring(0, 200) + '...'
          });
          setSession(null);
          setLoading(false);
          return;
        }
        
        // SECURE: Use getUser() instead of getSession() for authentication
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.log('[AUTH PROVIDER] Error getting user:', {
            message: error.message,
            status: error.status,
            code: error.code
          });

          // Handle refresh token error specifically
          if (error.message?.includes('refresh_token_not_found') ||
              error.message?.includes('Invalid Refresh Token') ||
              error.code === 'refresh_token_not_found') {
            console.log('[AUTH PROVIDER] Refresh token not found, clearing auth state');
            await validateAndUpdateSession(null);
          } else if (error.message?.includes('JWT') || error.message?.includes('token')) {
            console.log('[AUTH PROVIDER] Token-related error, clearing session');
            await validateAndUpdateSession(null);
          } else {
            console.log('[AUTH PROVIDER] Unknown user error, clearing session');
            await validateAndUpdateSession(null);
          }
        } else if (user) {
          console.log('[AUTH PROVIDER] Got authenticated user:', {
            hasUser: !!user,
            userId: user?.id,
            userEmail: user?.email
          });
          // Get user for the authenticated user (more secure than getSession)
          const { data: { user: verifiedUser } } = await supabase.auth.getUser();
          await validateAndUpdateSession(verifiedUser ? { user: verifiedUser } : null);
        } else {
          console.log('[AUTH PROVIDER] No authenticated user found');
          await validateAndUpdateSession(null);
        }
      } catch (err: any) {
        console.log('[AUTH PROVIDER] Exception getting session:', {
          message: err.message,
          stack: err.stack?.substring(0, 200) + '...'
        });
        setSession(null);
      } finally {
        console.log('[AUTH PROVIDER] Setting loading to false');
        setLoading(false);
      }
    };

    initializeAuth();

    let supabase;
    try {
      supabase = supabaseBrowser();
    } catch (clientError: any) {
      console.log('[AUTH PROVIDER] Error creating Supabase client for auth state change:', {
        message: clientError.message,
        stack: clientError.stack?.substring(0, 200) + '...'
      });
      setLoading(false);
      return;
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
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
  }, [validateAndUpdateSession, clearSession, mounted]);

  // Don't render children until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ session: null, loading: true, signOut, refreshAuth }}>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ session, loading, signOut, refreshAuth }}>
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
