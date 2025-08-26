'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';

function now() {
  return new Date().toISOString();
}

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  error?: string;
}

const AuthContext = createContext<AuthContextType>({ session: null, loading: true, authReady: false });

export function AuthenticatedClientProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  console.log('[AUTH DEBUG] AuthenticatedClientProvider state:', {
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    loading,
    authReady,
    error,
    timestamp: now()
  });

  useEffect(() => {
    let cancelled = false;
    console.log('[AUTH DEBUG] AuthenticatedClientProvider mounted', { t: now() });

    async function bootstrap() {
      try {
        const supabase = createClient();
        
        // Check if we have valid environment variables
        const hasValidConfig = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        
        if (!hasValidConfig) {
          console.error('[AUTH DEBUG] Missing Supabase configuration');
          setError('Supabase configuration is missing. Please check environment variables.');
          setLoading(false);
          setAuthReady(true);
          return;
        }
        
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
            setError(`Session fetch error: ${error.message}`);
            setSession(null);
          } else {
            setSession(session);
            setError(undefined);
          }
          setLoading(false);
          setAuthReady(true);
          console.log('[AUTH DEBUG] Auth provider ready', { t: now() });
        }
      } catch (err: any) {
        console.error('[AUTH DEBUG] Bootstrap error:', { t: now(), message: err?.message });
        if (!cancelled) {
          setError(`Bootstrap error: ${err?.message || 'Unknown error'}`);
          setSession(null);
          setLoading(false);
          setAuthReady(true); // avoid infinite spinner on error
        }
      }
    }

    bootstrap();

    const supabase = createClient();
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
              setSession(session);
              setLoading(false);
              setError(undefined);
            }
          }, 100);
        } else {
          setSession(session);
          setLoading(false);
          setError(undefined);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, authReady, error }}>
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
