
export const runtime = 'nodejs';
import QRCodeClientWrapper from './QRCodeClientWrapper';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default async function QrCodesPage({ params }: { params: { venueId: string }}) {
  const v = params.venueId;
  return (
    <>
      <NavigationBreadcrumb venueId={v} />
      <QRCodeClientWrapper venueId={v} venueName={''} />
    </>
  );
}