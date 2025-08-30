'use client';

import { useEffect, useState } from 'react';
import { createClient, checkPKCEState, clearAuthStorage } from '@/lib/supabase/client';

export default function DebugAuthPage() {
  const [authState, setAuthState] = useState<any>(null);
  const [pkceState, setPkceState] = useState<any>(null);
  const [storageState, setStorageState] = useState<any>(null);
  
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();
        
        setAuthState({
          hasSession: !!data?.session,
          hasUser: !!data?.session?.user,
          userId: data?.session?.user?.id,
          userEmail: data?.session?.user?.email,
          expiresAt: data?.session?.expires_at,
          error: error?.message
        });
      } catch (err) {
        setAuthState({ error: String(err) });
      }
    }
    
    function checkStorage() {
      try {
        // Get all localStorage keys
        const localStorageKeys = Object.keys(localStorage);
        const sessionStorageKeys = Object.keys(sessionStorage);
        
        // Filter auth-related keys
        const authLocalKeys = localStorageKeys.filter(k => 
          k.includes('supabase') || k.includes('sb-') || k.includes('auth') || k.includes('token') || k.includes('verifier')
        );
        
        const authSessionKeys = sessionStorageKeys.filter(k => 
          k.includes('supabase') || k.includes('sb-') || k.includes('auth') || k.includes('token') || k.includes('verifier')
        );
        
        // Check for PKCE verifier
        const pkceVerifier = localStorage.getItem('supabase.auth.token-code-verifier');
        
        setStorageState({
          localStorageTotal: localStorageKeys.length,
          sessionStorageTotal: sessionStorageKeys.length,
          authLocalKeys,
          authSessionKeys,
          hasPkceVerifier: !!pkceVerifier,
          pkceVerifierLength: pkceVerifier?.length || 0
        });
      } catch (err) {
        setStorageState({ error: String(err) });
      }
    }
    
    checkAuth();
    setPkceState(checkPKCEState());
    checkStorage();
  }, []);
  
  async function handleClearAuth() {
    try {
      clearAuthStorage();
      window.location.reload();
    } catch (err) {
      console.error('Error clearing auth storage:', err);
    }
  }
  
  async function handleForceSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: 'global' });
      window.location.reload();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }
  
  async function handleRedirectToSignIn() {
    window.location.href = '/sign-in';
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Auth State</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-60">
            {JSON.stringify(authState, null, 2)}
          </pre>
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">PKCE State</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-60">
            {JSON.stringify(pkceState, null, 2)}
          </pre>
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Storage State</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-60">
            {JSON.stringify(storageState, null, 2)}
          </pre>
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Actions</h2>
          <div className="flex flex-col space-y-2">
            <button 
              onClick={handleClearAuth}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
            >
              Clear Auth Storage
            </button>
            <button 
              onClick={handleForceSignOut}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Force Sign Out
            </button>
            <button 
              onClick={handleRedirectToSignIn}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
