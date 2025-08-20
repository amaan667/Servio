import ClientNavBar from '@/components/ClientNavBar';

export default function VenueDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { venueId: string };
}) {
  return (
    <>
      <ClientNavBar venueId={params.venueId} />
      {children}
    </>
  );
}
