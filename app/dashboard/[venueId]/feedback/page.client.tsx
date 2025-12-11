"use client";

import { EnhancedFeedbackSystem } from "@/components/enhanced-feedback-system";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import { TierRestrictionBanner } from "@/components/TierRestrictionBanner";

interface FeedbackClientPageProps {
  venueId: string;
  tier: string;
  role: string;
  hasAccess: boolean;
}

export default function FeedbackClientPage({
  venueId,
  tier,
  role,
  hasAccess,
}: FeedbackClientPageProps) {
  // Show tier restriction if no access
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
          <RoleBasedNavigation venueId={venueId} userRole={role as UserRole} userName="User" />
          <TierRestrictionBanner
            currentTier={tier}
            requiredTier="pro"
            featureName="Customer Feedback System"
            venueId={venueId}
            reason="Customer Feedback requires Pro tier or higher"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation venueId={venueId} userRole={role as UserRole} userName="User" />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Customer Feedback</h1>
          <p className="text-lg text-foreground mt-2">
            View analytics, manage feedback responses, and create custom questions
          </p>
        </div>

        <EnhancedFeedbackSystem venueId={venueId} />
      </div>
    </div>
  );
}
