import dynamic from "next/dynamic";

const QRCodeClientPage = dynamic(() => import("./page.client"), {
  ssr: false,
  loading: () => null, // No loading spinner - render immediately
});

export default async function QRCodePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Render fully client-side with no SSR to prevent hydration issues
  return <QRCodeClientPage venueId={venueId} />;
}
