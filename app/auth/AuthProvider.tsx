'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { authLogger } from '@/lib/logger';

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
  signOut: async () => {},
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
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  // Start with loading false if we have an initial session, true otherwise
  const [loading, setLoading] = useState(!initialSession);

  useEffect(() => {
    logger.debug('[AUTH DEBUG] AuthProvider useEffect starting', {
      timestamp: new Date().toISOString(),
      hasInitialSession: !!initialSession,
      initialSessionUserId: initialSession?.user?.id,
    });

    let supabase;
    try {
      supabase = supabaseBrowser();
      logger.debug('[AUTH DEBUG] Supabase browser client initialized successfully');
    } catch (error) {
      logger.error('[AUTH DEBUG] Error initializing Supabase browser client:', error);
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }
    
    // Get initial session quickly - only if we don't have one already
    const getInitialSession = async () => {
      if (initialSession) {
        // We already have a session, no need to fetch
        logger.debug('[AUTH DEBUG] Using initial session from server', {
          userId: initialSession.user.id,
        });
        setLoading(false);
        return;
      }
      
      logger.debug('[AUTH DEBUG] Fetching session from client');
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        logger.debug('[AUTH DEBUG] Client session fetched', {
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
        });
        
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setLoading(false);
      } catch (error) {
        logger.error('[AUTH DEBUG] Error fetching client session:', error);
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };
    
    // Get initial session immediately
    getInitialSession();
    
    // Handle auth state changes
    let subscription: any;
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event: any, newSession: any) => {
        logger.debug('[AUTH DEBUG] Auth state changed', {
          event,
          hasSession: !!newSession,
          userId: newSession?.user?.id,
          timestamp: new Date().toISOString(),
        });

        switch (event) {
          case 'SIGNED_IN':
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setLoading(false);
            break;
          case 'SIGNED_OUT':
            setSession(null);
            setUser(null);
            setLoading(false);
            break;
          case 'TOKEN_REFRESHED':
            setSession(newSession);
            setUser(newSession?.user ?? null);
            break;
          case 'USER_UPDATED':
            setSession(newSession);
            setUser(newSession?.user ?? null);
            break;
          default:
            if (newSession) {
              setSession(newSession);
              setUser(newSession?.user ?? null);
            }
            setLoading(false);
        }
      });
      subscription = data?.subscription;
      logger.debug('[AUTH DEBUG] Auth state change listener registered');
    } catch (error) {
      logger.error('[AUTH DEBUG] Error setting up auth state listener:', error);
      setLoading(false);
    }
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps is intentional - we only want to run once on mount

  const signOut = async () => {
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logger.error('[AUTH DEBUG] Supabase signOut error:', error);
      }
      
      // Clear local state immediately
      setSession(null);
      setUser(null);
    } catch (error) {
      logger.error('[AUTH DEBUG] AuthProvider signOut error:', error);
      // Clear local state even if there's an error
      setSession(null);
      setUser(null);
    }
  };

  const value = useMemo(() => ({ session, user, loading, signOut }), [session, user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
