"use client";

import { useState } from 'react';
import { generateCodeVerifier, generateCodeChallenge, storePkceVerifier, getPkceVerifier, clearPkceVerifier } from '@/lib/auth/pkce-utils.js';

export default function DebugPkcePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [verifier, setVerifier] = useState<string>('');
  const [challenge, setChallenge] = useState<string>('');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testPkceGeneration = async () => {
    addLog('=== Testing PKCE Generation ===');
    
    try {
      // Generate verifier and challenge
      const newVerifier = generateCodeVerifier();
      addLog(`Generated verifier: ${newVerifier.substring(0, 20)}...`);
      setVerifier(newVerifier);
      
      const newChallenge = await generateCodeChallenge(newVerifier);
      addLog(`Generated challenge: ${newChallenge.substring(0, 20)}...`);
      setChallenge(newChallenge);
      
      // Store verifier
      storePkceVerifier(newVerifier);
      addLog('Stored verifier in sessionStorage');
      
      // Verify storage
      const retrievedVerifier = getPkceVerifier();
      addLog(`Retrieved verifier: ${retrievedVerifier ? retrievedVerifier.substring(0, 20) + '...' : 'null'}`);
      
      addLog('PKCE generation test completed successfully');
    } catch (error) {
      addLog(`PKCE generation test failed: ${error}`);
    }
  };

  const testStorage = () => {
    addLog('=== Testing Storage ===');
    
    try {
      // Check localStorage
      const localStorageKeys = Object.keys(localStorage);
      const pkceLocalKeys = localStorageKeys.filter(k => k.includes('pkce') || k.includes('token-code-verifier'));
      addLog(`localStorage PKCE keys: ${pkceLocalKeys.join(', ')}`);
      
      // Check sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage);
      const pkceSessionKeys = sessionStorageKeys.filter(k => k.includes('pkce'));
      addLog(`sessionStorage PKCE keys: ${pkceSessionKeys.join(', ')}`);
      
      // Check specific verifier
      const storedVerifier = getPkceVerifier();
      addLog(`Custom verifier in storage: ${storedVerifier ? 'found' : 'not found'}`);
      
      const supabaseVerifier = localStorage.getItem('supabase.auth.token-code-verifier');
      addLog(`Supabase verifier in storage: ${supabaseVerifier ? 'found' : 'not found'}`);
      
    } catch (error) {
      addLog(`Storage test failed: ${error}`);
    }
  };

  const clearStorage = () => {
    addLog('=== Clearing Storage ===');
    
    try {
      clearPkceVerifier();
      addLog('Cleared custom PKCE verifier');
      
      // Clear Supabase PKCE keys
      Object.keys(localStorage).forEach(key => {
        if (key.includes('pkce') || key.includes('token-code-verifier')) {
          localStorage.removeItem(key);
          addLog(`Cleared localStorage key: ${key}`);
        }
      });
      
      addLog('Storage cleared');
    } catch (error) {
      addLog(`Storage clearing failed: ${error}`);
    }
  };

  const testGoogleSignIn = async () => {
    addLog('=== Testing Google Sign-In ===');
    
    try {
      // Import the sign-in function
      const { signInWithGoogle } = await import('@/lib/auth/signin');
      
      addLog('Starting Google sign-in...');
      await signInWithGoogle();
      addLog('Google sign-in initiated (redirect should happen)');
      
    } catch (error) {
      addLog(`Google sign-in test failed: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">PKCE Debug Page</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">PKCE Values</h2>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Verifier:</label>
                <input 
                  type="text" 
                  value={verifier} 
                  readOnly 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Challenge:</label>
                <input 
                  type="text" 
                  value={challenge} 
                  readOnly 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={testPkceGeneration}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Test PKCE Generation
              </button>
              <button
                onClick={testStorage}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Test Storage
              </button>
              <button
                onClick={clearStorage}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Clear Storage
              </button>
              <button
                onClick={testGoogleSignIn}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
              >
                Test Google Sign-In
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-gray-100 p-4 rounded-md max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run a test to see debug information.</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-gray-800">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setLogs([])}
            className="mt-4 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  );
}