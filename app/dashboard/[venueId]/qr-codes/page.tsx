
export const runtime = 'nodejs';
import Link from 'next/link';
import { venuePath } from '@/lib/path';
import dynamic from 'next/dynamic';

const QRCodeClient = dynamic(() => import('./QRCodeClient'), { ssr: false });

export default async function QrCodesPage({ params }: { params: { venueId: string }}) {
  const v = params.venueId;
  return (
    <>
      <nav className="mb-4 flex items-center gap-2 text-sm breadcrumbs">
        <Link href={venuePath(v)} className="text-gray-600 hover:text-gray-900">Home</Link>
        <span className="text-gray-400">/</span>
        <Link href={venuePath(v)} className="text-gray-600 hover:text-gray-900">Dashboard</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-700 font-medium">QR Codes</span>
      </nav>
      <QRCodeClient venueId={v} venueName={''} />
    </>
  );
}