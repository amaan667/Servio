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
          
          // Handle refresh token errors specifically
          if (error.message?.includes('refresh_token_not_found') || 
              error.message?.includes('Invalid Refresh Token') ||
              error.message?.includes('Refresh Token Not Found')) {
            console.warn('[AUTH DEBUG] provider:refresh_token_error - clearing invalid session');
            await supabase.auth.signOut();
          } else {
            // Clear invalid session on other errors
            await supabase.auth.signOut();
          }
          
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (err: any) {
        console.error('[AUTH DEBUG] provider:getSession:unexpected', { t: now(), message: err?.message, stack: err?.stack });
        
        // Handle refresh token errors in catch block too
        if (err?.message?.includes('refresh_token_not_found') || 
            err?.message?.includes('Invalid Refresh Token') ||
            err?.message?.includes('Refresh Token Not Found')) {
          console.warn('[AUTH DEBUG] provider:refresh_token_error_catch - clearing invalid session');
          if (supabase) {
            await supabase.auth.signOut();
          }
        } else {
          // Clear session on other unexpected errors
          if (supabase) {
            await supabase.auth.signOut();
          }
        }
        
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH DEBUG] provider:onAuthStateChange', { t: now(), event, hasSession: !!session, userId: session?.user?.id });
      
      // Handle specific auth events
      if (event === 'TOKEN_REFRESHED') {
        console.log('[AUTH DEBUG] provider:token-refreshed', { t: now() });
        if (!session) {
          console.warn('[AUTH DEBUG] provider:token_refresh_failed - clearing invalid session');
          await supabase.auth.signOut();
        }
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        console.log('[AUTH DEBUG] provider:signed-out', { t: now() });
        setSession(null);
      } else if (event === 'SIGNED_IN') {
        console.log('[AUTH DEBUG] provider:signed-in', { t: now() });
        setSession(session);
      } else {
        setSession(session);
      }
      
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
