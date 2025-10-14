// This file is deprecated - use GenerateQRClient.tsx instead
import GenerateQRClient from './GenerateQRClient';

interface Props {
  venueId: string;
  venueName: string;
  activeTablesCount?: number;
}

export default function GenerateQRClientSimple({ venueId, venueName }: Props) {
  return <GenerateQRClient venueId={venueId} venueName={venueName} />;
}