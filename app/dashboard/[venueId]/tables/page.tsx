import { Suspense } from 'react';
import { TableManagementClient } from './table-management-client';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

interface TableManagementPageProps {
  params: {
    venueId: string;
  };
}

export default function TableManagementPage({ params }: TableManagementPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={params.venueId} />
        <Suspense fallback={<div>Loading...</div>}>
          <TableManagementClient venueId={params.venueId} />
        </Suspense>
      </div>
    </div>
  );
}
