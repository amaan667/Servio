import StaffClient from './staff-client';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default async function StaffPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Staff Management
          </h1>
          <p className="text-lg text-foreground mt-2">
            Invite and manage your staff members
          </p>
        </div>
        
        <StaffClient venueId={venueId} />
      </div>
    </div>
  );
}