'use client';

import LiveOrdersList from '@/components/LiveOrdersList';

export default function LiveOrdersPageClient({ venueId }: { venueId: string }) {
  console.log('[LIVE ORDERS PAGE DEBUG] Component mounted with venueId:', venueId);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Live Orders</h1>
        <p className="text-gray-600">Today's active orders that need attention</p>
      </div>

      <LiveOrdersList venueId={venueId} />
    </div>
  );
}

