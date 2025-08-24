"use client";

import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

const QRCodeClient = dynamic(() => import('./QRCodeClient'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading QR codes...</p>
      </div>
    </div>
  )
});

export default function QRCodeClientWrapper(props: { venueId: string; venueName: string }) {
  return (
    <ErrorBoundary>
      <QRCodeClient {...props} />
    </ErrorBoundary>
  );
}
