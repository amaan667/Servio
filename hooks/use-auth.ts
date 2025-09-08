'use client';

import { useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // SECURE: Use getUser() for authentication checks
  const checkUser = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('[AUTH HOOK] Error getting user:', error);
        setAuthState({ user: null, loading: false, error: error.message });
        return;
      }
      
      setAuthState({ user, loading: false, error: null });
    } catch (error) {
      console.error('[AUTH HOOK] Unexpected error:', error);
      setAuthState({ 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Authentication error' 
      });
    }
  }, []);

  // Sign out function that works on both desktop and mobile
  const signOut = useCallback(async () => {
    try {
      console.log('[AUTH HOOK] Starting sign out process');
      
      // First, call the server-side signout API to clear cookies
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[AUTH HOOK] Server signout failed:', response.status);
      } else {
        console.log('[AUTH HOOK] Server signout successful');
      }

      // Then, call the client-side signout to clear local state
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[AUTH HOOK] Client signout error:', error);
        throw error;
      }

      // Clear local state
      setAuthState({ user: null, loading: false, error: null });
      
      console.log('[AUTH HOOK] Sign out completed successfully');
    } catch (error) {
      console.error('[AUTH HOOK] Sign out error:', error);
      setAuthState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Sign out failed' 
      }));
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Check initial auth state
    checkUser();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        console.log('[AUTH HOOK] Auth state change:', event, session?.user?.id);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // SECURE: Use getUser() to get the latest user data
          const { data: { user }, error } = await supabase.auth.getUser();
          setAuthState({ 
            user: error ? null : user, 
            loading: false, 
            error: error?.message || null 
          });
        } else if (event === 'SIGNED_OUT') {
          setAuthState({ user: null, loading: false, error: null });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkUser]);

  return {
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    signOut,
    refresh: checkUser,
  };
}