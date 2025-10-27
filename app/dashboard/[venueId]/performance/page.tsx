/**
 * Performance Monitoring Dashboard
 * Real-time performance metrics and analytics
 */

import { PerformanceDashboardClient } from "./PerformanceDashboardClient";

export default function PerformancePage({ params }: { params: Promise<{ venueId: string }> }) {
  return <PerformanceDashboardClient venueId={(params as any).venueId} />;
}
