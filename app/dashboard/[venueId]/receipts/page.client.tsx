"use client";

import ReceiptsClient from "./ReceiptsClient";

interface ReceiptsClientPageProps {
  venueId: string;
}

export default function ReceiptsClientPage({ venueId }: ReceiptsClientPageProps) {
  return <ReceiptsClient venueId={venueId} />;
}
