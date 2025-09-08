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
    console.log('[MINIMAL AUTH PROVIDER] Component mounted');
    setMounted(true);
  }, []);

  // Simple initialization without async
  useEffect(() => {
    if (!mounted) {
      return;
    }

    console.log('[MINIMAL AUTH PROVIDER] Starting initialization');
    
    // Simple synchronous initialization
    setSession(null);
    setLoading(false);
    
    console.log('[MINIMAL AUTH PROVIDER] Initialization completed');
  }, [mounted]);

  const signOut = async () => {
    console.log('[MINIMAL AUTH PROVIDER] Signing out');
    setSession(null);
  };

  console.log('[MINIMAL AUTH PROVIDER] Render state:', { mounted, loading, hasSession: !!session });

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
