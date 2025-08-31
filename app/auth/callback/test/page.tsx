'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';

export default function TestCallbackPage() {
  const [currentUrl, setCurrentUrl] = useState<string>('Loading...');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCurrentUrl(window.location.href);
    console.log('[AUTH DEBUG] === TEST CALLBACK PAGE LOADED ===');
    console.log('[AUTH DEBUG] Test callback page is accessible');
    console.log('[AUTH DEBUG] Current URL:', window.location.href);
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Callback Page</h1>
        <p className="text-gray-600">This page is accessible. Check console for debug info.</p>
        <div className="mt-4 p-4 bg-blue-100 rounded">
          <p className="text-sm text-blue-800">
            URL: {isClient ? currentUrl : 'Server side'}
          </p>
        </div>
      </div>
    </div>
  );
}
