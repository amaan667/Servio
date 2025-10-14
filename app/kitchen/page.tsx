export const dynamic = 'force-dynamic';

import KitchenClient from './KitchenClient';
import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";

export default function KitchenPage() {
  console.log('[KITCHEN] Starting KitchenPage');
  
  // Default values for demo/standalone mode
  const defaultVenueId = 'venue-1e02af4d';
  const defaultVenueName = 'Servio Café';

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  Kitchen Display System
                </h1>
                <p className="text-lg mt-2">
                  Real-time kitchen order management and display
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{defaultVenueName}</span>
                  <span className="mx-2">•</span>
                  <span>Venue ID: {defaultVenueId}</span>
                </div>
              </div>
            </div>
          </div>
          
          <KitchenClient 
            venueId={defaultVenueId}
            venueName={defaultVenueName}
          />
        </div>
      </div>
      
      {/* AI Assistant - Global Command Palette (⌘K / Ctrl-K) */}
      <AssistantCommandPalette venueId={defaultVenueId} showChatHistory={true} />
    </>
  );
}
