import { Suspense } from 'react';
import { TableManagementRefactored } from './table-management-refactored';
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
          <TableManagementRefactored venueId={params.venueId} />
        </Suspense>
      </div>
    </div>
  );
}
