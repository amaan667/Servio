"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/site";

export default function DebugOAuthPage() {
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runDiagnostics = async () => {
      const results: any = {};

      try {
        // Environment check
        results.environment = {
          nodeEnv: process.env.NODE_ENV,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
          appUrl: process.env.APP_URL,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing",
          supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing",
          origin: siteOrigin(),
        };

        // Supabase client test
        try {
          const supabase = createClient();
          const { data, error } = await supabase.auth.getSession();
          results.supabaseClient = {
            status: error ? "❌ Error" : "✅ Working",
            error: error?.message,
            hasSession: !!data.session,
          };
        } catch (err: any) {
          results.supabaseClient = {
            status: "❌ Failed",
            error: err.message,
          };
        }

        // URL configuration
        results.urls = {
          callbackUrl: `${siteOrigin()}/auth/callback`,
          apiCallbackUrl: `${siteOrigin()}/api/auth/callback`,
          signInUrl: `${siteOrigin()}/sign-in`,
        };

        // Browser info
        if (typeof window !== "undefined") {
          results.browser = {
            userAgent: navigator.userAgent,
            location: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname,
          };
        }

        setDiagnostics(results);
      } catch (error: any) {
        setDiagnostics({ error: error.message });
      } finally {
        setLoading(false);
      }
    };

    runDiagnostics();
  }, []);

  const testOAuth = async () => {
    try {
      const supabase = createClient();
      const origin = siteOrigin();
      const redirectTo = `${origin}/auth/callback`;
      
      console.log('[AUTH DEBUG] Testing OAuth with:', redirectTo);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          flowType: "pkce",
          redirectTo: redirectTo,
        },
      });

      if (error) {
        alert(`OAuth Error: ${error.message}`);
      } else {
        alert("OAuth initiated successfully - check browser redirect");
      }
    } catch (err: any) {
      alert(`Exception: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">OAuth Diagnostics</h1>
        
        <div className="grid gap-6">
          {/* Environment */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
            <div className="space-y-2">
              {Object.entries(diagnostics.environment || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-mono text-sm">{key}:</span>
                  <span className="font-mono text-sm">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Supabase Client */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Supabase Client</h2>
            <div className="space-y-2">
              {Object.entries(diagnostics.supabaseClient || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-mono text-sm">{key}:</span>
                  <span className="font-mono text-sm">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* URLs */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">URL Configuration</h2>
            <div className="space-y-2">
              {Object.entries(diagnostics.urls || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-mono text-sm">{key}:</span>
                  <span className="font-mono text-sm break-all">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Browser Info */}
          {diagnostics.browser && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Browser Information</h2>
              <div className="space-y-2">
                {Object.entries(diagnostics.browser).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="font-mono text-sm">{key}:</span>
                    <span className="font-mono text-sm break-all">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Button */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Test OAuth</h2>
            <button
              onClick={testOAuth}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Test Google OAuth Flow
            </button>
            <p className="text-sm text-gray-600 mt-2">
              This will initiate the OAuth flow and show any errors in the console.
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">Next Steps</h2>
            <div className="space-y-2 text-blue-700">
              <p>1. Copy the callback URLs above and add them to your Supabase OAuth settings</p>
              <p>2. Add the same URLs to your Google OAuth configuration</p>
              <p>3. Test the OAuth flow using the button above</p>
              <p>4. Check the browser console for detailed debug logs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
