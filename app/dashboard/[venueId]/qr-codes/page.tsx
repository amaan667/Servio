"use client";

import { use } from "react";
import QRCodeClientPage from "./page.client";

export default function QRCodePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);

  // Render fully client-side to handle auth and data loading properly
  return <QRCodeClientPage venueId={venueId} />;
}
