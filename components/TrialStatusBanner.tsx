"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { logger } from "@/lib/logger";

interface TrialStatus {
  isTrialing: boolean;
  subscriptionStatus: string;
  tier: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

interface TrialStatusBannerProps {
  userRole?: string;
}

export default function TrialStatusBanner({ userRole }: TrialStatusBannerProps) {
  const { user } = useAuth();

  // Cache trial status to prevent flicker
  const getCachedTrialStatus = () => {
    if (typeof window === "undefined" || !user?.id) return null;
    const cached = sessionStorage.getItem(`trial_status_${user.id}`);
    return cached ? JSON.parse(cached) : null;
  };

  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(getCachedTrialStatus());
  const [loading, setLoading] = useState(false);

  // Helper function to process trial status (defined before hooks that use it)
  const processTrialStatus = useCallback(
    (org: { subscription_status?: string; subscription_tier?: string; trial_ends_at?: string }) => {
      const subscriptionStatus = org.subscription_status || "basic";
      const tier = org.subscription_tier || "basic";
      const trialEndsAt = org.trial_ends_at;

      // Processing trial status

      // Check if trial has expired
      let isTrialing = false;
      let daysRemaining = null;

      if (trialEndsAt) {
        const endDate = new Date(trialEndsAt);
        const now = new Date();

        // Date calculation

        // Set both dates to start of day for accurate day counting
        const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const diffTime = endDateStart.getTime() - nowStart.getTime();
        daysRemaining = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // Days calculation

        // Trial is active if we have days remaining and status is trialing
        isTrialing = subscriptionStatus === "trialing" && daysRemaining > 0;
      }

      // Final trial status calculated
      const _status: TrialStatus = {
        isTrialing,
        subscriptionStatus,
        tier,
        trialEndsAt: trialEndsAt || null,
        daysRemaining,
      };
      setTrialStatus(_status);
      if (typeof window !== "undefined" && user?.id) {
        sessionStorage.setItem(`trial_status_${user.id}`, JSON.stringify(_status));
      }
    },
    [user]
  );

  const fetchTrialStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetching organization data

      // Use client-side Supabase to query organizations directly (RLS allows this)
      const { supabaseBrowser } = await import("@/lib/supabase");
      const supabase = supabaseBrowser();

      // Query using created_by (actual database column)
      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .select("id, subscription_tier, subscription_status, trial_ends_at, created_by")
        .eq("created_by", user.id)
        .maybeSingle();

      if (orgError) {
        // Show a default trial status if query fails (better than nothing)
        const userCreatedAt = new Date(user.created_at);
        const trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.max(
          0,
          Math.floor((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );

        const defaultStatus = {
          isTrialing: true,
          subscriptionStatus: "trialing",
          tier: "basic",
          trialEndsAt: trialEndsAt.toISOString(),
          daysRemaining,
        };
        setTrialStatus(defaultStatus);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`trial_status_${user.id}`, JSON.stringify(defaultStatus));
        }
        setLoading(false);
        return;
      }

      if (organization) {
        logger.debug("[TRIAL BANNER] Organization data loaded:", {
          id: organization.id,
          subscription_status: organization.subscription_status,
          subscription_tier: organization.subscription_tier,
          trial_ends_at: organization.trial_ends_at,
        });

        // Organization exists - use its actual trial_ends_at from database
        processTrialStatus({
          subscription_status: organization.subscription_status,
          subscription_tier: organization.subscription_tier,
          trial_ends_at: organization.trial_ends_at,
        });
      } else {
        // Show default trial status based on user creation date
        const userCreatedAt = new Date(user.created_at);
        const trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.max(
          0,
          Math.floor((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );

        const status = {
          isTrialing: true,
          subscriptionStatus: "trialing",
          tier: "basic",
          trialEndsAt: trialEndsAt.toISOString(),
          daysRemaining,
        };
        setTrialStatus(status);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`trial_status_${user.id}`, JSON.stringify(status));
        }
      }
    } catch (_error) {
      // Show default trial status as fallback
      const userCreatedAt = user.created_at ? new Date(user.created_at) : new Date();
      const trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      // Validate date
      if (isNaN(trialEndsAt.getTime())) {
        // Invalid date, use 14 days from now
        trialEndsAt.setTime(Date.now() + 14 * 24 * 60 * 60 * 1000);
      }
      
      const daysRemaining = Math.max(
        0,
        Math.floor((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );

      const status = {
        isTrialing: true,
        subscriptionStatus: "trialing",
        tier: "basic",
        trialEndsAt: trialEndsAt.toISOString(),
        daysRemaining,
      };
      setTrialStatus(status);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`trial_status_${user.id}`, JSON.stringify(status));
      }
    } finally {
      setLoading(false);
    }
  }, [user, processTrialStatus]);

  useEffect(() => {
    if (user) {
      fetchTrialStatus();
    } else {
      setTrialStatus(null);
      setLoading(false);
    }
  }, [user, fetchTrialStatus]);

  // Daily refresh to update countdown
  useEffect(() => {
    if (!user || !trialStatus?.isTrialing) return;

    // Calculate time until next midnight for daily refresh
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout to refresh at midnight
    const timeoutId = setTimeout(() => {
      fetchTrialStatus();

      // Set up recurring daily refresh
      const dailyInterval = setInterval(
        () => {
          fetchTrialStatus();
        },
        24 * 60 * 60 * 1000
      ); // 24 hours

      // Clean up interval on unmount
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, [user, trialStatus?.isTrialing, fetchTrialStatus]);

  // Hourly refresh to catch unknown edge cases
  useEffect(() => {
    if (!user || !trialStatus?.isTrialing) return;

    const hourlyInterval = setInterval(
      () => {
        fetchTrialStatus();
      },
      60 * 60 * 1000
    ); // 1 hour

    return () => clearInterval(hourlyInterval);
  }, [user, trialStatus?.isTrialing, fetchTrialStatus]);

  // Auto-refresh when returning from checkout success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("upgrade") === "success") {
      // Refresh trial status after successful upgrade with retry logic
      const refreshWithRetry = async (attempt = 0) => {
        try {
          // Directly fetch organization data
          const ensureOrgResponse = await fetch("/api/organization/ensure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (!ensureOrgResponse.ok) {
            if (attempt < 3) {
              setTimeout(() => refreshWithRetry(attempt + 1), (attempt + 1) * 2000);
            }
            return;
          }

          const { organization } = await ensureOrgResponse.json();

          // Process and update trial status
          if (organization) {
            processTrialStatus({
              subscription_status: organization.subscription_status,
              subscription_tier: organization.subscription_tier,
              trial_ends_at: organization.trial_ends_at,
            });
          } else if (attempt < 3) {
            // If no organization data, retry
            setTimeout(() => refreshWithRetry(attempt + 1), (attempt + 1) * 2000);
          }
        } catch {
          if (attempt < 3) {
            setTimeout(() => refreshWithRetry(attempt + 1), (attempt + 1) * 2000);
          }
        }
      };

      // Start immediate refresh
      refreshWithRetry();

      // Remove query params after a short delay
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("upgrade");
        window.history.replaceState(
          {
            /* Empty */
          },
          document.title,
          url.toString()
        );
      }, 3000);
    }
  }, []);

  // Only show trial status banner for owners
  if (userRole && userRole !== "owner") {
    return null;
  }

  // Only show if loading, no status, or trial is NOT active
  if (loading || !trialStatus) {
    return null;
  }

  // ONLY show if trial is actively running (not expired, not paid)
  if (!trialStatus.isTrialing) {
    return null;
  }

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case "basic":
        return "Basic";
      case "standard":
        return "Standard";
      case "premium":
        return "Premium";
      default:
        return tier.charAt(0).toUpperCase() + tier.slice(1);
    }
  };

  const getTrialEndDate = (trialEndsAt: string) => {
    return new Date(trialEndsAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysRemainingColor = (days: number) => {
    if (days <= 0) return "bg-red-600 text-white";
    if (days <= 3) return "bg-red-500 text-white";
    if (days <= 7) return "bg-orange-500 text-white";
    if (days <= 14) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  // Render trial status banner (only when actively trialing)
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-blue-900">
              {getTierDisplayName(trialStatus.tier)} Plan - Free Trial Active
            </span>
          </div>

          {trialStatus.daysRemaining !== null && (
            <div className="flex items-center gap-2">
              <Badge
                className={`${getDaysRemainingColor(trialStatus.daysRemaining)} font-bold text-sm px-3 py-1`}
              >
                {trialStatus.daysRemaining === 0
                  ? "⚠️ Trial Expired"
                  : trialStatus.daysRemaining === 1
                    ? "🔥 1 Day Left"
                    : trialStatus.daysRemaining <= 3
                      ? `⚠️ ${trialStatus.daysRemaining} Days Left`
                      : trialStatus.daysRemaining <= 7
                        ? `⏰ ${trialStatus.daysRemaining} Days Left`
                        : `✅ ${trialStatus.daysRemaining} Days Left`}
              </Badge>
              {trialStatus.daysRemaining <= 7 && (
                <span className="text-sm text-orange-600 font-medium">Upgrade to continue</span>
              )}
            </div>
          )}
        </div>

        {trialStatus.trialEndsAt && (
          <div className="flex items-center gap-2 text-blue-700">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Trial ends {getTrialEndDate(trialStatus.trialEndsAt)}</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-sm text-blue-700">
        Enjoy full access to all {getTierDisplayName(trialStatus.tier)} features during your trial
        period.
        {trialStatus.daysRemaining !== null && trialStatus.daysRemaining <= 7 && (
          <span className="font-medium ml-1">
            Consider upgrading to continue without interruption.
          </span>
        )}
      </div>
    </div>
  );
}
