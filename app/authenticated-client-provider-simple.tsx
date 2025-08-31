'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  session: null, 
  loading: true,
  signOut: async () => {}
});

export function AuthenticatedClientProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    console.log('[SIMPLE AUTH PROVIDER] Initializing');
    
    // Simulate a simple auth check
    const initializeAuth = async () => {
      try {
        console.log('[SIMPLE AUTH PROVIDER] Checking for existing session...');
        
        // Check localStorage for any existing session
        const existingSession = localStorage.getItem('sb-auth-token');
        
        if (existingSession) {
          console.log('[SIMPLE AUTH PROVIDER] Found existing session');
          setSession({ user: { id: 'test-user' } });
        } else {
          console.log('[SIMPLE AUTH PROVIDER] No existing session found');
          setSession(null);
        }
      } catch (err: any) {
        console.log('[SIMPLE AUTH PROVIDER] Error:', err.message);
        setSession(null);
      } finally {
        console.log('[SIMPLE AUTH PROVIDER] Setting loading to false');
        setLoading(false);
      }
    };

    initializeAuth();
  }, [mounted]);

  const signOut = async () => {
    console.log('[SIMPLE AUTH PROVIDER] Signing out');
    setSession(null);
    localStorage.removeItem('sb-auth-token');
  };

  // Don't render children until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ session: null, loading: true, signOut }}>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
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
