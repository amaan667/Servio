import OrdersClient from './OrdersClient';
import PageHeader from '@/components/PageHeader';

export default function OrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Orders"
          description="Monitor and manage orders"
          venueId={venueId}
        />
        <OrdersClient venueId={venueId} />
      </div>
    </div>
  );
}
