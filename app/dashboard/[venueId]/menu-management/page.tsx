import MenuManagementClient from './MenuManagementClient';

export default function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <>
      <MenuManagementClient venueId={venueId} />
    </>
  );
}