"use client";

import KDSClient from "./KDSClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";

interface KDSClientPageProps {
  venueId: string;
  initialTickets?: unknown[] | null;
  initialStations?: unknown[] | null;
  tier: string;
  kdsTier: "advanced" | "enterprise" | false;
  role: string;
}

export default function KDSClientPage({
  venueId,
  initialTickets,
  initialStations,
  tier,
  kdsTier,
  role,
}: KDSClientPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation venueId={venueId} userRole={role as UserRole} userName="User" />

        <div className="mb-8 mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Kitchen Display System
            </h1>
            <p className="text-lg text-foreground mt-2">
              Manage kitchen prep stations and ticket flow
              {kdsTier === "advanced" && " (Multi-station enabled)"}
              {kdsTier === "enterprise" &&
                " (Multi-venue & multi-station enabled - use venue switcher to manage all locations)"}
            </p>
          </div>
          {kdsTier && (
            <div className="flex items-center gap-2">
              {kdsTier === "advanced" && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                  Advanced KDS
                </Badge>
              )}
              {kdsTier === "enterprise" && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                  Enterprise KDS
                </Badge>
              )}
            </div>
          )}
        </div>

        <KDSClient
          venueId={venueId}
          initialTickets={initialTickets || undefined}
          initialStations={initialStations || undefined}
          kdsTier={kdsTier}
          tier={tier}
        />
      </div>
    </div>
  );
}
