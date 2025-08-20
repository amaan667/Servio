import NavBarClient from '@/components/NavBarClient';
import MenuManagementClient from './MenuManagementClient';

export default function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <NavBarClient />
      <MenuManagementClient venueId={venueId} />
    </>
  );
}