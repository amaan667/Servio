import ClientNavBar from '@/components/ClientNavBar';
import MenuManagementClient from './MenuManagementClient';

export default function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <ClientNavBar venueId={venueId} />
      <MenuManagementClient venueId={venueId} />
    </>
  );
}