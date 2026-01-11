"use client";

import { EnhancedFeedbackSystem } from "@/components/enhanced-feedback-system";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";

interface FeedbackClientPageProps {

  }>;
}

export default function FeedbackClientPage({
  venueId,
  role,
  initialQuestions = [],
}: FeedbackClientPageProps) {
  // Customer feedback is available to all tiers - no restriction needed

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

        <EnhancedFeedbackSystem venueId={venueId} initialQuestions={initialQuestions} />
      </div>
    </div>
  );
}
