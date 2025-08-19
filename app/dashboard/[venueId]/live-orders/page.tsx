import NavBar from '@/components/NavBar';
import LiveOrdersClient from './LiveOrdersClient';

export default function LiveOrdersPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <NavBar venueId={venueId} />
      <LiveOrdersClient venueId={venueId} />
    </>
  );
}