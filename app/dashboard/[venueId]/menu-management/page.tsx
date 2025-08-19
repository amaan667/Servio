import NavBar from '@/components/NavBar';
import MenuManagementClient from './MenuManagementClient';

export default function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <NavBar venueId={venueId} />
      <MenuManagementClient venueId={venueId} />
    </>
  );
}