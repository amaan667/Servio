/**
 * Performance Monitoring Dashboard
 * Real-time performance metrics and analytics
 */

import { PerformanceDashboardClient } from "./PerformanceDashboardClient";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export default async function PerformancePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId);

  return <PerformanceDashboardClient venueId={venueId} />;
}
