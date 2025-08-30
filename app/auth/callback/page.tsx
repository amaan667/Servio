'use client';

import { useEffect, useRef } from 'react';

export default function AuthCallbackPage() {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    
    // Simple debug log that the callback page was loaded
    fetch('/api/auth/debug-oauth', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CALLBACK_PAGE_LOADED' }) 
    }).catch(() => {
      // Ignore errors
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
        <p className="text-xs text-gray-400 mt-2">Please wait while we verify your account</p>
      </div>
    </div>
  );
}
