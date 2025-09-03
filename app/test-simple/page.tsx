'use client';

import { useState, useEffect } from 'react';
import LiveOrdersList from '@/components/LiveOrdersList';
import { Badge } from '@/components/ui/badge';

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
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Live Orders Test</h1>
        <p className="text-gray-600 mb-6">Testing the new LiveOrdersList component with matching badge logic</p>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-2">Test Info</h2>
          <p className="text-sm text-gray-600">Mounted: {mounted.toString()}</p>
          <p className="text-sm text-gray-600">Loading: {loading.toString()}</p>
          <p className="text-sm text-gray-600">Testing with venue ID: test-venue-123</p>
        </div>

        {/* Badge showing the count - this should match the list */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Live Orders Count</h3>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              Live Orders
            </Badge>
            <span className="text-sm text-gray-600">
              (This badge count should match the list below)
            </span>
          </div>
        </div>

        <LiveOrdersList venueId="test-venue-123" />
      </div>
    </div>
  );
}
