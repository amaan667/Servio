import LiveOrdersClient from "./LiveOrdersClient";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

export default async function LiveOrdersPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Monitor and manage real-time orders
          </h1>
        </div>
        
        <LiveOrdersClient venueId={venueId} />
      </div>
    </div>
  );
}