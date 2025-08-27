"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TestOAuthPage() {
  const [status, setStatus] = useState("Ready to test");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testOAuth = async () => {
    try {
      setStatus("Starting OAuth test...");
      addLog("Starting OAuth test");
      
      const supabase = createClient();
      
      // Clear any existing state
      addLog("Clearing existing auth state");
      await supabase.auth.signOut();
      
      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      addLog(`Current session: ${session ? 'exists' : 'none'}`);
      
      // Start OAuth flow
      addLog("Starting OAuth flow with Google");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          flowType: "pkce",
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { 
            prompt: 'select_account',
            access_type: 'offline'
          },
          skipBrowserRedirect: false
        }
      });
      
      if (error) {
        addLog(`OAuth error: ${error.message}`);
        setStatus(`Error: ${error.message}`);
      } else {
        addLog("OAuth flow initiated successfully");
        setStatus("OAuth flow initiated - check browser");
      }
      
    } catch (error: any) {
      addLog(`Unexpected error: ${error.message}`);
      setStatus(`Error: ${error.message}`);
    }
  };

  const checkStorage = () => {
    addLog("Checking browser storage...");
    
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
    );
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
    );
    
    addLog(`localStorage keys: ${localStorageKeys.join(', ')}`);
    addLog(`sessionStorage keys: ${sessionStorageKeys.join(', ')}`);
    
    // Log some values
    localStorageKeys.forEach(key => {
      const value = localStorage.getItem(key);
      addLog(`${key}: ${value?.substring(0, 50)}...`);
    });
  };

  const clearStorage = () => {
    addLog("Clearing all storage...");
    localStorage.clear();
    sessionStorage.clear();
    addLog("Storage cleared");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">OAuth Test Page</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-4">
            <button
              onClick={testOAuth}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Test OAuth Flow
            </button>
            
            <button
              onClick={checkStorage}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ml-4"
            >
              Check Storage
            </button>
            
            <button
              onClick={clearStorage}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ml-4"
            >
              Clear Storage
            </button>
          </div>
          
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <strong>Status:</strong> {status}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
