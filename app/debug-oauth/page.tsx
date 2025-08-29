"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DebugOAuthPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setIsClient(true);
    setOrigin(window.location.origin);
  }, []);

  const testOAuth = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Test OAuth configuration
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      setDebugInfo({
        success: !error,
        data: data,
        error: error,
        redirectUrl: `${origin}/auth/callback`,
        currentUrl: window.location.href,
        origin: origin
      });
    } catch (err: any) {
      setDebugInfo({
        success: false,
        error: err.message,
        redirectUrl: `${origin}/auth/callback`,
        currentUrl: window.location.href,
        origin: origin
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
