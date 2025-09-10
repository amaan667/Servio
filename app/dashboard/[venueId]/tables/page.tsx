import { Suspense } from 'react';
import { TableManagementClientNew } from './table-management-client-new';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

interface TableManagementPageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function TableManagementPage({ params }: TableManagementPageProps) {
  const { venueId } = await params;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={venueId} />
        <Suspense fallback={<div className="text-center py-8 text-gray-600">Loading tables...</div>}>
          <TableManagementClientNew venueId={venueId} />
        </Suspense>
      </div>
    </div>
  );
}
