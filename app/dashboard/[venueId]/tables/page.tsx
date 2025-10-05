import { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

// Lazy load the heavy table management component
const TableManagementClientNew = dynamicImport(() => import('./table-management-client-new').then(mod => ({ default: mod.TableManagementClientNew })), {
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Tables</h2>
        <p className="text-gray-900">Setting up table management...</p>
      </div>
    </div>
  )
});

interface TableManagementPageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function TableManagementPage({ params }: TableManagementPageProps) {
  const { venueId } = await params;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        <Suspense fallback={<div className="text-center py-8 text-gray-900">Loading tables...</div>}>
          <TableManagementClientNew venueId={venueId} />
        </Suspense>
      </div>
    </div>
  );
}
