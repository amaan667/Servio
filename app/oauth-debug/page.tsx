"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OAuthDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testOAuth = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      console.log('[AUTH DEBUG] === OAuth Debug Test ===');
      console.log('[AUTH DEBUG] Window location:', window.location.href);
      console.log('[AUTH DEBUG] Window origin:', window.location.origin);
      console.log('[AUTH DEBUG] NODE_ENV:', process.env.NODE_ENV);
      console.log('[AUTH DEBUG] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
      
      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log('[AUTH DEBUG] RedirectTo URL:', redirectTo);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });

      console.log('[AUTH DEBUG] OAuth result:', { data, error });
      
      setDebugInfo({
        success: !error,
        data: data,
        error: error,
        redirectTo: redirectTo,
        windowOrigin: window.location.origin,
        windowLocation: window.location.href,
        nodeEnv: process.env.NODE_ENV,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[AUTH DEBUG] OAuth test error:', err);
      setDebugInfo({
        success: false,
        error: err.message,
        redirectTo: `${window.location.origin}/auth/callback`,
        windowOrigin: window.location.origin,
        windowLocation: window.location.href,
        nodeEnv: process.env.NODE_ENV,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">OAuth Debug Test</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h2 className="font-bold mb-2">Current Environment:</h2>
        <p><strong>Window Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'server-side'}</p>
        <p><strong>Window Location:</strong> {typeof window !== 'undefined' ? window.location.href : 'server-side'}</p>
        <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
        <p><strong>NEXT_PUBLIC_SITE_URL:</strong> {process.env.NEXT_PUBLIC_SITE_URL || 'NOT SET'}</p>
        <p><strong>Redirect URL:</strong> {typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'server-side'}</p>
      </div>
      
      <button
        onClick={testOAuth}
        disabled={loading}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? "Testing..." : "Test OAuth Configuration"}
      </button>

      {debugInfo && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Debug Info:</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
