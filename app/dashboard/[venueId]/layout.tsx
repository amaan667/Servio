import UniversalHeader from '@/components/UniversalHeader';

export default function VenueDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { venueId: string };
}) {
  return (
    <>
      <UniversalHeader venueId={params.venueId} />
      {children}
    </>
  );
}
