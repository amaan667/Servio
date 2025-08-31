'use client';

import { useState, useEffect } from 'react';

export default function TestSimplePage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[TEST SIMPLE] Component mounted');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    console.log('[TEST SIMPLE] Starting initialization');
    
    const timer = setTimeout(() => {
      console.log('[TEST SIMPLE] Setting loading to false');
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [mounted]);

  console.log('[TEST SIMPLE] Render state:', { mounted, loading });

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Mounting...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Test Simple Page</h1>
        <p className="text-gray-600">This page loaded successfully!</p>
        <p className="text-sm text-gray-500 mt-2">Mounted: {mounted.toString()}</p>
        <p className="text-sm text-gray-500">Loading: {loading.toString()}</p>
      </div>
    </div>
  );
}
