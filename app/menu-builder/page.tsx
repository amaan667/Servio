export const dynamic = 'force-dynamic';

import MenuBuilderClient from './MenuBuilderClient';
import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";

export default function MenuBuilderPage() {
  console.log('[MENU BUILDER] Starting MenuBuilderPage');
  
  // Default values for demo/standalone mode
  const defaultVenueId = 'venue-1e02af4d'; // Use the known venue ID from your system
  const defaultVenueName = 'Servio Café';

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  Menu Builder
                </h1>
                <p className="text-lg mt-2">
                  Design and manage your restaurant menu with our intuitive builder
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
          
          <MenuBuilderClient 
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
