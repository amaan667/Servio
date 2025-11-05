/**
 * Performance Monitoring Dashboard
 * Real-time performance metrics and analytics
 */

import { PerformanceDashboardClient } from "./PerformanceDashboardClient";

export default async function PerformancePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  return <PerformanceDashboardClient venueId={venueId} />;
}
