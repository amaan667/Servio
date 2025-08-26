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
        // 1) If we came back from OAuth, exchange the code for a session
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          const hasCode = url.searchParams.has("code");
          const hasError = url.searchParams.has("error");

          if (hasCode && !hasError) {
            console.log('[AUTH DEBUG] provider:exchanging code for session', { t: now() });
            const { error } = await supabase.auth.exchangeCodeForSession({
              queryParams: url.searchParams,
            });
            
            // Clean the URL (remove code & state) so refreshes don't re-run exchange
            url.searchParams.delete("code");
            url.searchParams.delete("state");
            const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
            window.history.replaceState({}, "", clean);

            if (error) {
              console.error('[AUTH DEBUG] provider:exchangeCodeForSession failed:', error);
            }
          }
        }

        // 2) Wait for initial session fetch
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
