import NavBarClient from '@/components/NavBarClient';
import OrdersClient from './OrdersClient';

export default function OrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <NavBarClient />
      <OrdersClient venueId={venueId} />
    </>
  );
}
