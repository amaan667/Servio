"use client";

import React from "react";

export default function SimpleDashboardClient({ 
  venueId, 
  userId, 
  venue, 
  userName,
  venueTz,
  initialCounts,
  initialStats
}: { 
  venueId: string; 
  userId: string; 
  venue?: any; 
  userName: string;
  venueTz: string;
  initialCounts?: any;
  initialStats?: any;
}) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          🎉 Dashboard is Loading!
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Debug Info:</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Venue ID:</strong> {venueId}</p>
            <p><strong>User ID:</strong> {userId}</p>
            <p><strong>User Name:</strong> {userName}</p>
            <p><strong>Venue Name:</strong> {venue?.venue_name || 'Loading...'}</p>
            <p><strong>Timezone:</strong> {venueTz}</p>
            <p><strong>Venue Data:</strong> {venue ? '✅ Loaded' : '❌ Missing'}</p>
          </div>
        </div>

        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <p className="font-semibold">✅ Success! Dashboard is working!</p>
          <p>If you can see this message, the basic dashboard is loading correctly.</p>
        </div>
      </div>
    </div>
  );
}
