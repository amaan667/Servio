import POSDashboardClient from './pos-dashboard-client';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default async function POSPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Point of Sale
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage tables, orders, and payments
          </p>
        </div>
        
        <POSDashboardClient venueId={venueId} />
      </div>
    </div>
  );
}