'use client';

import { useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';

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
        logger.error('[AUTH HOOK] Error getting user:', error);
        setAuthState({ user: null, loading: false, error: error.message });
        return;
      }
      
      setAuthState({ user, loading: false, error: null });
    } catch (error: unknown) {
      logger.error('[AUTH HOOK] Unexpected error:', getErrorDetails(error));
      setAuthState({ 
        user: null, 
        loading: false, 
        error: error instanceof Error ? getErrorMessage(error) : 'Authentication error' 
      });
    }
  }, []);

  // Sign out function that works on both desktop and mobile
  const signOut = useCallback(async () => {
    try {
      
      // First, call the server-side signout API to clear cookies
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        logger.error('[AUTH HOOK] Server signout failed:', response.status);
      } else {
      }

      // Then, call the client-side signout to clear local state
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logger.error('[AUTH HOOK] Client signout error:', error);
        throw error;
      }

      // Clear local state
      setAuthState({ user: null, loading: false, error: null });
      
    } catch (error: unknown) {
      logger.error('[AUTH HOOK] Sign out error:', getErrorDetails(error));
      setAuthState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? getErrorMessage(error) : 'Sign out failed' 
      }));
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Check initial auth state
    checkUser();

    // Set up auth state listener
    const onChange = supabase?.auth?.onAuthStateChange?.bind(supabase?.auth);
    const result = onChange
      ? onChange(
      async (event: any, session: any) => {
        
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
    )
      : undefined;

    const subscription = (result as any)?.data?.subscription;

    return () => {
      try {
        subscription?.unsubscribe?.();
      } catch {}
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