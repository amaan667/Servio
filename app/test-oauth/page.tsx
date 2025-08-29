"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TestOAuthPage() {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setOrigin(process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app');
  }, []);

  const testOAuth = async () => {
    try {
      setStatus("Testing OAuth configuration...");
      setError("");

      const supabase = createClient();
      
      console.log('[AUTH DEBUG] Test OAuth - Origin:', origin);
      console.log('[AUTH DEBUG] Test OAuth - Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('[AUTH DEBUG] Test OAuth - Has anon key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

      const redirectTo = `${origin}/auth/callback`;
      console.log('[AUTH DEBUG] Test OAuth - Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo,
        },
      });

      if (error) {
        console.error('[AUTH DEBUG] Test OAuth - Error:', error);
        setError(`OAuth error: ${error.message}`);
        setStatus("Failed");
      } else {
        console.log('[AUTH DEBUG] Test OAuth - Success:', data);
        setStatus("OAuth initiated successfully - check browser redirect");
      }
    } catch (err: any) {
      console.error('[AUTH DEBUG] Test OAuth - Exception:', err);
      setError(`Exception: ${err.message}`);
      setStatus("Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">OAuth Test</h1>
        
                  <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="font-semibold mb-2">Environment Check:</h2>
            <p>Origin: {isClient ? origin : "Loading..."}</p>
            <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"}</p>
            <p>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"}</p>
            <p>Redirect URL: {isClient ? `${origin}/auth/callback` : "Loading..."}</p>
          </div>

        <button
          onClick={testOAuth}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Test Google OAuth
        </button>

        {status && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="font-semibold">Status: {status}</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="font-semibold text-red-800">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p>This test will:</p>
          <ul className="list-disc list-inside ml-4">
            <li>Check environment variables</li>
            <li>Test Supabase client creation</li>
            <li>Initiate Google OAuth flow</li>
            <li>Show any errors in the process</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
