'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

function now() {
  return new Date().toISOString();
}

interface AuthContextType {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ session: null, loading: true });

export function AuthenticatedClientProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AUTH DEBUG] provider:mount', { t: now() });

    const getInitialSession = async () => {
      try {
        console.log('[AUTH DEBUG] provider:getSession:begin', { t: now() });
        
        // Check if supabase is available
        if (!supabase) {
          console.error('[AUTH DEBUG] provider:getSession:no-client', { t: now() });
          setSession(null);
          setLoading(false);
          return;
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[AUTH DEBUG] provider:getSession:done', { t: now(), hasSession: !!session, userId: session?.user?.id, err: error?.message });
        if (error) {
          console.error('[AUTH DEBUG] provider:getSession:error', { t: now(), error: error.message });
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (err: any) {
        console.error('[AUTH DEBUG] provider:getSession:unexpected', { t: now(), message: err?.message, stack: err?.stack });
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Only set up auth state listener if supabase is available
    if (!supabase) {
      console.error('[AUTH DEBUG] provider:no-client-for-listener', { t: now() });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH DEBUG] provider:onAuthStateChange', { t: now(), event, hasSession: !!session, userId: session?.user?.id });
      setSession(session);
      setLoading(false);
    });

    return () => {
      console.log('[AUTH DEBUG] provider:unmount', { t: now() });
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
