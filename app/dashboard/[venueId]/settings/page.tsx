import VenueSettingsClient from './VenueSettingsClient';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default async function VenueSettings({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Venue Settings
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage your venue settings and preferences
          </p>
        </div>
        
        <VenueSettingsClient venueId={venueId} />
      </div>
    </div>
  );
}