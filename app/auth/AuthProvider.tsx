'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/browser';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let supabase;
    try {
      supabase = supabaseBrowser();
    } catch (error) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }
    
    // Get initial session quickly
    const getInitialSession = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        setSession(currentUser ? { user: currentUser } : null);
        setUser(currentUser);
        setLoading(false);
      } catch (error) {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };
    
    // Get initial session immediately
    getInitialSession();
    
    // Handle auth state changes
    let subscription;
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
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
      subscription = data.subscription;
    } catch (error) {
      setLoading(false);
    }
    
    return () => subscription.subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log('[AUTH DEBUG] AuthProvider signOut called');
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.log('[AUTH DEBUG] Supabase signOut error:', error);
      } else {
        console.log('[AUTH DEBUG] Supabase signOut successful');
      }
      
      // Clear local state immediately
      setSession(null);
      setUser(null);
      
      console.log('[AUTH DEBUG] AuthProvider signOut completed');
    } catch (error) {
      console.log('[AUTH DEBUG] AuthProvider signOut error:', error);
      // Clear local state even if there's an error
      setSession(null);
      setUser(null);
    }
  };

  const value = useMemo(() => ({ session, user, loading, signOut }), [session, user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
