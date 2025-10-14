export const dynamic = 'force-dynamic';

import MenuBuilderClient from './MenuBuilderClient';
import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default function MenuBuilderPage() {
  console.log('[MENU BUILDER] Starting MenuBuilderPage');
  
  // Default values for demo/standalone mode
  const defaultVenueId = 'venue-1e02af4d'; // Use the known venue ID from your system
  const defaultVenueName = 'Servio Café';

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
          <NavigationBreadcrumb venueId={defaultVenueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Menu Builder
            </h1>
            <p className="text-lg text-foreground mt-2">
              Design and manage your restaurant menu with our intuitive builder
            </p>
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
