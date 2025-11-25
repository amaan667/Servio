"use client";

import KDSClient from "./KDSClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import { TierRestrictionBanner } from "@/components/TierRestrictionBanner";

interface KDSClientPageProps {
  venueId: string;
  initialTickets?: unknown[] | null;
  initialStations?: unknown[] | null;
  tier: string;
  role: string;
  hasAccess: boolean;
}

export default function KDSClientPage({
  venueId,
  initialTickets,
  initialStations,
  tier,
  role,
  hasAccess,
}: KDSClientPageProps) {
  // Show tier restriction if no access
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
          <RoleBasedNavigation
            venueId={venueId}
            userRole={role as UserRole}
            userName="User"
          />
          <TierRestrictionBanner
            currentTier={tier}
            requiredTier="enterprise"
            featureName="Kitchen Display System (KDS)"
            venueId={venueId}
            reason="KDS requires Enterprise tier"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={role as UserRole}
          userName="User"
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Kitchen Display System
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage kitchen prep stations and ticket flow
          </p>
        </div>

        <KDSClient
          venueId={venueId}
          initialTickets={initialTickets || undefined}
          initialStations={initialStations || undefined}
        />
      </div>
    </div>
  );
}
