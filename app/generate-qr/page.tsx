export const dynamic = 'force-dynamic';

import GenerateQRClient from './GenerateQRClient';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default function GenerateQRPage() {
  console.log('[QR PAGE] Starting GenerateQRPage - No Auth Required');
  
  // Default values for demo/standalone mode
  const defaultVenueId = 'venue-1e02af4d'; // Use the known venue ID from your system
  const defaultVenueName = 'Servio Café';
  const defaultTablesCount = 0; // Start with 0, user can add tables

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <NavigationBreadcrumb venueId={defaultVenueId} />
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            QR Code Generator
          </h1>
          <p className="text-lg mt-2">
            Generate and manage QR codes for your tables and counters
          </p>
        </div>
        
        <GenerateQRClient 
          venueId={defaultVenueId}
          venueName={defaultVenueName}
          activeTablesCount={defaultTablesCount}
        />
      </div>
    </div>
  );
}