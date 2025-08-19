import ClientNavBar from '@/components/ClientNavBar';
import OrdersClient from './OrdersClient';

export default function OrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <ClientNavBar venueId={venueId} />
      <OrdersClient venueId={venueId} />
    </>
  );
}
