import OrdersClient from './OrdersClient';

export default function OrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <OrdersClient venueId={venueId} />
    </>
  );
}
