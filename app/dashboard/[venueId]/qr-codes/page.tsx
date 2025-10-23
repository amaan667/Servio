import dynamic from "next/dynamic";

const QRCodeClientPage = dynamic(() => import("./page.client"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  ),
});

export default async function QRCodePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Render fully client-side with no SSR to prevent hydration issues
  return <QRCodeClientPage venueId={venueId} />;
}
