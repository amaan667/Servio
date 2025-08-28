'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/sb-client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

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

  const updateSession = useCallback((newSession: Session | null) => {
    setSession(prevSession => {
      // Only update if the session actually changed
      if (prevSession?.user?.id !== newSession?.user?.id) {
        console.log('[AUTH DEBUG] provider:session:changed', { 
          t: now(), 
          oldUserId: prevSession?.user?.id, 
          newUserId: newSession?.user?.id 
        });
        return newSession;
      }
      return prevSession;
    });
  }, []);

  // Validate session and clear if invalid
  const validateAndUpdateSession = useCallback(async (session: Session | null) => {
    if (!session) {
      updateSession(null);
      return;
    }

    // Check if session has required fields
    if (!session.user?.id || !session.access_token) {
      console.log('[AUTH DEBUG] provider:invalid session detected', {
        hasUser: !!session.user,
        hasUserId: !!session.user?.id,
        hasAccessToken: !!session.access_token,
        timestamp: now()
      });
      updateSession(null);
      return;
    }

    // Check if session is expired
    if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
      console.log('[AUTH DEBUG] provider:expired session detected', {
        expiresAt: session.expires_at,
        currentTime: Math.floor(Date.now() / 1000),
        timestamp: now()
      });
      updateSession(null);
      return;
    }

    updateSession(session);
  }, [updateSession]);

  useEffect(() => {
    console.log('[AUTH DEBUG] provider:mount', { t: now() });

    const getInitialSession = async () => {
      try {
        console.log('[AUTH DEBUG] provider:getSession:begin', { t: now() });
        const { data: { session }, error } = await createClient().auth.getSession();
        console.log('[AUTH DEBUG] provider:getSession:done', { t: now(), hasSession: !!session, userId: session?.user?.id, err: error?.message });
        if (error) {
          await validateAndUpdateSession(null);
        } else {
          await validateAndUpdateSession(session);
        }
      } catch (err: any) {
        console.log('[AUTH DEBUG] provider:getSession:unexpected', { t: now(), message: err?.message });
        await validateAndUpdateSession(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    const { data: { subscription } } = createClient().auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[AUTH DEBUG] provider:onAuthStateChange', { t: now(), event, hasSession: !!session, userId: session?.user?.id });
      await validateAndUpdateSession(session);
      setLoading(false);
    });

    return () => {
      console.log('[AUTH DEBUG] provider:unmount', { t: now() });
      subscription.unsubscribe();
    };
  }, [validateAndUpdateSession]);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
