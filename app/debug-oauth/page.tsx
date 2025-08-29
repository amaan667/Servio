"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DebugOAuthPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testOAuth = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Test OAuth configuration
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          flowType: "pkce",
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setDebugInfo({
        success: !error,
        data: data,
        error: error,
        redirectUrl: `${window.location.origin}/auth/callback`,
        currentUrl: window.location.href,
        origin: window.location.origin
      });
    } catch (err: any) {
      setDebugInfo({
        success: false,
        error: err.message,
        redirectUrl: `${window.location.origin}/auth/callback`,
        currentUrl: window.location.href,
        origin: window.location.origin
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">OAuth Debug</h1>
      
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
