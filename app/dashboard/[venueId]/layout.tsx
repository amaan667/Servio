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
      {/* Dashboard: show only profile menu (blue circle) */}
      <UniversalHeader venueId={params.venueId} showHamburgerMenu={false} showProfileMenu={true} />
      {children}
    </>
  );
}
