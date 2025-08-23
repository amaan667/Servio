
export const runtime = 'nodejs';
import QRCodeClientWrapper from './QRCodeClientWrapper';
import PageHeader from '@/components/PageHeader';

export default async function QrCodesPage({ params }: { params: { venueId: string }}) {
  const v = params.venueId;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="QR Codes"
          description="Generate and manage QR codes for your venue"
          venueId={v}
        />
        <QRCodeClientWrapper venueId={v} venueName={''} />
      </div>
    </div>
  );
}