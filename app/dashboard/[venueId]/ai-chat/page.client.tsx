"use client";

import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import { TierRestrictionBanner } from "@/components/TierRestrictionBanner";

interface AIChatClientPageProps {
  venueId: string;
  tier: string;
  role: string;
  hasAccess: boolean;
}

export default function AIChatClientPage({
  venueId,
  tier,
  role,
  hasAccess,
}: AIChatClientPageProps) {
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
            featureName="AI Assistant"
            venueId={venueId}
            reason="AI Assistant requires Enterprise tier"
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Assistant</h1>
          <p className="text-lg text-foreground mt-2">
            Get help and insights from your AI assistant
          </p>
        </div>

        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Assistant</h2>
          <p className="text-gray-600">AI Chat functionality coming soon!</p>
        </div>
      </div>
    </div>
  );
}
