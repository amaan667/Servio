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
    if (!mounted) {
      return;
    }

    console.log('[WORKING AUTH PROVIDER] Initializing');
    
    // Simple initialization that always completes
    const initializeAuth = async () => {
      try {
        console.log('[WORKING AUTH PROVIDER] Starting auth check...');
        
        // Simulate a brief auth check
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // For now, just set no session
        setSession(null);
        console.log('[WORKING AUTH PROVIDER] Auth check completed - no session');
      } catch (err: any) {
        console.log('[WORKING AUTH PROVIDER] Error during auth check:', err.message);
        setSession(null);
      } finally {
        console.log('[WORKING AUTH PROVIDER] Setting loading to false');
        setLoading(false);
      }
    };

    initializeAuth();
  }, [mounted]);

  const signOut = async () => {
    console.log('[WORKING AUTH PROVIDER] Signing out');
    setSession(null);
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
