import { Suspense } from 'react';
import { TableManagementClient } from './table-management-client';

interface TableManagementPageProps {
  params: {
    venueId: string;
  };
}

export default function TableManagementPage({ params }: TableManagementPageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TableManagementClient venueId={params.venueId} />
    </Suspense>
  );
}
