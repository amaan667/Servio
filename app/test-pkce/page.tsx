"use client";

import { useState } from 'react';
import { signInWithGoogle } from '@/lib/auth/signin';
import { clearAuthStorage, checkPKCEState } from '@/lib/supabase/client';

export default function TestPkcePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [pkceState, setPkceState] = useState<any>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testPkceFlow = async () => {
    addLog('=== Testing PKCE Flow ===');
    
    try {
      // Clear any existing state
      clearAuthStorage();
      addLog('Cleared existing auth storage');
      
      // Check initial state
      const initialState = checkPKCEState();
      setPkceState(initialState);
      addLog(`Initial PKCE state: ${JSON.stringify(initialState)}`);
      
      // Test the sign-in flow
      addLog('Starting Google sign-in flow...');
      await signInWithGoogle();
      addLog('Sign-in flow initiated (should redirect to Google)');
      
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    }
  };

  const checkCurrentState = () => {
    const state = checkPKCEState();
    setPkceState(state);
    addLog(`Current PKCE state: ${JSON.stringify(state)}`);
  };

  const clearStorage = () => {
    clearAuthStorage();
    addLog('Cleared all auth storage');
    checkCurrentState();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">PKCE Flow Test</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-4">
              <button
                onClick={testPkceFlow}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Test PKCE Flow
              </button>
              
              <button
                onClick={checkCurrentState}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Check Current State
              </button>
              
              <button
                onClick={clearStorage}
                className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Clear Storage
              </button>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">PKCE State</h2>
            <div className="bg-white p-4 rounded border">
              <pre className="text-sm overflow-auto max-h-64">
                {pkceState ? JSON.stringify(pkceState, null, 2) : 'No state available'}
              </pre>
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-white p-4 rounded border max-h-96 overflow-auto">
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="text-sm font-mono text-gray-700">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}