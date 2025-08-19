"use client";

import dynamic from 'next/dynamic';
const QRCodeClient = dynamic(() => import('./QRCodeClient'), { ssr: false });

export default function QRCodeClientWrapper(props: { venueId: string; venueName: string }) {
  return <QRCodeClient {...props} />;
}
