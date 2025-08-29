export default function VenueDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { venueId: string };
}) {
  return (
    <>
      {children}
    </>
  );
}
