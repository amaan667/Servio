'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/browser';

type AuthValue = {
  session: Session | null;
  user: User | null;
  // Keep 'loading' for callers, but start as FALSE to match server render
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthValue>({
  session: null,
  user: null,
  loading: false,
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
  // IMPORTANT: false initially so server & client markup match
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    
    // Handle auth state changes with error handling
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[AUTH DEBUG] Auth state change:', event, newSession?.user?.id);
      
      // Handle specific auth events
      switch (event) {
        case 'SIGNED_IN':
          console.log('[AUTH DEBUG] User signed in successfully');
          setSession(newSession);
          setUser(newSession?.user ?? null);
          break;
        case 'SIGNED_OUT':
          console.log('[AUTH DEBUG] User signed out');
          setSession(null);
          setUser(null);
          break;
        case 'TOKEN_REFRESHED':
          console.log('[AUTH DEBUG] Token refreshed successfully');
          setSession(newSession);
          setUser(newSession?.user ?? null);
          break;
        case 'USER_UPDATED':
          console.log('[AUTH DEBUG] User updated');
          setSession(newSession);
          setUser(newSession?.user ?? null);
          break;
        default:
          console.log('[AUTH DEBUG] Unknown auth event:', event);
          setSession(newSession);
          setUser(newSession?.user ?? null);
      }
    });
    
    return () => subscription.subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
  };

  const value = useMemo(() => ({ session, user, loading, signOut }), [session, user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
