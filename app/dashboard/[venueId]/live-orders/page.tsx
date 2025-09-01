import { LiveOrdersNew } from "@/components/live-orders-new";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

export default function LiveOrdersPage({ params }: { params: { venueId: string } }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={params.venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Live Orders
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Monitor and manage real-time orders
          </p>
        </div>
        
        <LiveOrdersNew venueId={params.venueId} venueTimezone="Europe/London" />
      </div>
    </div>
  );
}