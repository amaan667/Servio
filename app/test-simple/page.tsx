'use client';

import { useState, useEffect } from 'react';
import LiveOrdersList from '@/components/LiveOrdersList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function TestSimplePage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testVenueId, setTestVenueId] = useState('test-venue-123');

  useEffect(() => {
    setMounted(true);
    setLoading(false);
  }, []);


  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Live Orders Test</h1>
        <p className="text-gray-600 mb-6">Testing the new LiveOrdersList component with matching badge logic</p>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-2">Test Info</h2>
          <p className="text-sm text-gray-600">Mounted: {mounted.toString()}</p>
          <p className="text-sm text-gray-600">Loading: {loading.toString()}</p>
          <p className="text-sm text-gray-600">Testing with venue ID: {testVenueId}</p>
        </div>

        {/* Manual test controls */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-2">Manual Test Controls</h3>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={testVenueId}
              onChange={(e) => setTestVenueId(e.target.value)}
              placeholder="Enter venue ID to test"
              className="px-3 py-2 border rounded-md"
            />
            <Button 
              onClick={() => {
                console.log('[TEST SIMPLE] Manual refresh triggered for venue:', testVenueId);
                // Force a page refresh to test with new venue ID
                window.location.reload();
              }}
              variant="outline"
            >
              Test with New Venue ID
            </Button>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Change the venue ID above and click the button to test with different IDs
          </p>
        </div>

        {/* Badge showing the count - this should match the list */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
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

        {/* Debug info */}
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
          <div className="text-sm text-yellow-700 space-y-1">
            <div>Check browser console for detailed [LIVE_ORDERS_DEBUG] logs</div>
            <div>Current time: {new Date().toISOString()}</div>
            <div>Test venue ID: {testVenueId}</div>
            <div>Component mounted: {mounted.toString()}</div>
          </div>
        </div>

        <LiveOrdersList venueId={testVenueId} />
      </div>
    </div>
  );
}
