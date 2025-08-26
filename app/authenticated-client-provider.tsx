'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/sb-client';
import { Session } from '@supabase/supabase-js';

function now() {
  return new Date().toISOString();
}

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  authReady: boolean;
}

const AuthContext = createContext<AuthContextType>({ session: null, loading: true, authReady: false });

export function AuthenticatedClientProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  console.log('[AUTH DEBUG] AuthenticatedClientProvider state:', {
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    loading,
    authReady,
    timestamp: now()
  });

  useEffect(() => {
    let cancelled = false;
    console.log('[AUTH DEBUG] AuthenticatedClientProvider mounted', { t: now() });

    async function bootstrap() {
      try {
        // Wait for initial session fetch
        console.log('[AUTH DEBUG] Getting initial session', { t: now() });
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('[AUTH DEBUG] Initial session result:', { 
          t: now(), 
          hasSession: !!session, 
          userId: session?.user?.id, 
          userEmail: session?.user?.email,
          error: error?.message 
        });
        
        if (!cancelled) {
          if (error) {
            console.error('[AUTH DEBUG] Session fetch error:', error);
            setSession(null);
          } else {
            setSession(session);
          }
          setLoading(false);
          setAuthReady(true);
          console.log('[AUTH DEBUG] Auth provider ready', { t: now() });
        }
      } catch (err: any) {
        console.error('[AUTH DEBUG] Bootstrap error:', { t: now(), message: err?.message });
        if (!cancelled) {
          setSession(null);
          setLoading(false);
          setAuthReady(true); // avoid infinite spinner on error
        }
      }
    }

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH DEBUG] Auth state change in provider:', { 
        t: now(), 
        event, 
        hasSession: !!session, 
        userId: session?.user?.id,
        userEmail: session?.user?.email 
      });
      
      if (!cancelled) {
        // Add a small delay for sign-in events to ensure session is fully established
        if (event === 'SIGNED_IN') {
          setTimeout(() => {
            if (!cancelled) {
              console.log('[AUTH DEBUG] provider:delayed session update after sign-in');
              setSession(session);
              setLoading(false);
              setAuthReady(true);
            }
          }, 1000);
        } else {
          setSession(session);
          setLoading(false);
          setAuthReady(true);
        }
      }
    });

    return () => {
      cancelled = true;
      console.log('[AUTH DEBUG] AuthenticatedClientProvider unmounting', { t: now() });
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, authReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
