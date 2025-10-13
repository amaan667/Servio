import BillingClient from './billing-client';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default async function BillingPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Billing & Subscription
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage your subscription and billing
          </p>
        </div>
        
        <BillingClient 
          venueId={venueId} 
          venueName="Your Venue"
          organization={{
            id: 'temp-org',
            subscription_tier: 'basic',
            subscription_status: 'active',
            trial_ends_at: null
          }}
          usage={{
            menuItems: 0,
            tables: 0,
            staff: 0,
            venues: 1
          }}
        />
      </div>
    </div>
  );
}