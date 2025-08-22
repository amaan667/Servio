import MenuManagementClient from './MenuManagementClient';

export default function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const venueId = params.venueId;
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MenuManagementClient venueId={venueId} />
      </div>
    </div>
  );
}