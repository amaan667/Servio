export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

// This route now simply redirects to the single QR page
export default async function QRCodeRedirect({ params }: { params: { venueId: string } }) {
  redirect(`/generate-qr?venue=${params.venueId}`);
}