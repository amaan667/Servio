import NavBar from '@/components/NavBar';
import OrdersClient from './OrdersClient';

export default function OrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <NavBar venueId={venueId} />
      <OrdersClient venueId={venueId} />
    </>
  );
}
