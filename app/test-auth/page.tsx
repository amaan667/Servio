"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { debugPKCEState, checkAuthState } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/lib/auth/signin";

export default function TestAuthPage() {
  const [authState, setAuthState] = useState<any>(null);
  const [pkceState, setPkceState] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkState = async () => {
    const auth = await checkAuthState();
    const pkce = debugPKCEState();
    setAuthState(auth);
    setPkceState(pkce);
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const sb = createClient();
    await sb.auth.signOut();
    await checkState();
  };

  useEffect(() => {
    checkState();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Auth Debug Page</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Authentication State</h2>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(authState, null, 2)}
            </pre>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">PKCE State</h2>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(pkceState, null, 2)}
            </pre>
          </div>
        </div>
        
        <div className="mt-8 flex gap-4">
          <button
            onClick={checkState}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh State
          </button>
          
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In with Google"}
          </button>
          
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}