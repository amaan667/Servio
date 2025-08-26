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

  useEffect(() => {
    let cancelled = false;
    console.log('[AUTH DEBUG] provider:mount', { t: now() });

    async function bootstrap() {
      try {
        // Wait for initial session fetch
        console.log('[AUTH DEBUG] provider:getSession:begin', { t: now() });
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[AUTH DEBUG] provider:getSession:done', { t: now(), hasSession: !!session, userId: session?.user?.id, err: error?.message });
        
        if (!cancelled) {
          if (error) {
            setSession(null);
          } else {
            setSession(session);
          }
          setLoading(false);
          setAuthReady(true);
        }
      } catch (err: any) {
        console.log('[AUTH DEBUG] provider:bootstrap error:', { t: now(), message: err?.message });
        if (!cancelled) {
          setSession(null);
          setLoading(false);
          setAuthReady(true); // avoid infinite spinner on error
        }
      }
    }

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH DEBUG] provider:onAuthStateChange', { t: now(), event, hasSession: !!session, userId: session?.user?.id });
      if (!cancelled) {
        setSession(session);
        setLoading(false);
        setAuthReady(true);
      }
    });

    return () => {
      cancelled = true;
      console.log('[AUTH DEBUG] provider:unmount', { t: now() });
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
