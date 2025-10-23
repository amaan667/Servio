"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";

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
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Only show trial status banner for owners
  if (userRole && userRole !== "owner") {
    return null;
  }

  const fetchTrialStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Use client-side Supabase to get organization data directly
      const { supabaseBrowser } = await import("@/lib/supabase");
      const supabase = supabaseBrowser();

      console.info("[TRIAL BANNER] Fetching organization data for user:", user.id);

      // Get user's organization directly from client
      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .select(
          "id, subscription_tier, subscription_status, is_grandfathered, trial_ends_at, created_by, owner_user_id"
        )
        .or(`created_by.eq.${user.id},owner_user_id.eq.${user.id}`)
        .maybeSingle();

      if (orgError) {
        console.warn("[TRIAL BANNER] Organization query error:", orgError);
        // Set fallback trial status
        setTrialStatus({
          isTrialing: true,
          subscriptionStatus: "trialing",
          tier: "basic",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 14,
        });
        setLoading(false);
        return;
      }

      if (organization) {
        console.info("[TRIAL BANNER] Organization data:", {
          subscription_status: organization.subscription_status,
          subscription_tier: organization.subscription_tier,
          trial_ends_at: organization.trial_ends_at,
        });

        processTrialStatus({
          subscription_status: organization.subscription_status,
          subscription_tier: organization.subscription_tier,
          trial_ends_at: organization.trial_ends_at,
        });
      } else {
        console.info("[TRIAL BANNER] No organization found, using fallback trial status");
        // Use fallback trial status based on user creation date
        const userCreatedAt = new Date(user.created_at);
        const trialEndsAt = new Date(userCreatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

        setTrialStatus({
          isTrialing: true,
          subscriptionStatus: "trialing",
          tier: "basic",
          trialEndsAt: trialEndsAt.toISOString(),
          daysRemaining: Math.max(
            0,
            Math.floor((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          ),
        });
      }
    } catch (error) {
      console.warn("[TRIAL BANNER] Fetch error:", error);
      // Set a fallback trial status if everything fails
      setTrialStatus({
        isTrialing: true,
        subscriptionStatus: "trialing",
        tier: "basic",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 14,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const processTrialStatus = (org: unknown) => {
    const subscriptionStatus = org.subscription_status || "basic";
    const tier = org.subscription_tier || "basic";
    const trialEndsAt = org.trial_ends_at;

    console.info("[TRIAL BANNER] Processing trial status:", {
      subscriptionStatus,
      tier,
      trialEndsAt,
    });

    // Check if trial has expired
    let isTrialing = false;
    let daysRemaining = null;

    if (trialEndsAt) {
      const endDate = new Date(trialEndsAt);
      const now = new Date();

      console.info("[TRIAL BANNER] Date calculation:", {
        trialEndsAt,
        endDate: endDate.toISOString(),
        now: now.toISOString(),
      });

      // Set both dates to start of day for accurate day counting
      const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const diffTime = endDateStart.getTime() - nowStart.getTime();
      daysRemaining = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      console.info("[TRIAL BANNER] Days calculation:", {
        endDateStart: endDateStart.toISOString(),
        nowStart: nowStart.toISOString(),
        diffTime,
        daysRemaining,
      });

      // Trial is active if we have days remaining and status is trialing
      isTrialing = subscriptionStatus === "trialing" && daysRemaining > 0;
    }

    console.info("[TRIAL BANNER] Final status:", {
      isTrialing,
      subscriptionStatus,
      tier,
      trialEndsAt,
      daysRemaining,
    });

    setTrialStatus({
      isTrialing,
      subscriptionStatus,
      tier,
      trialEndsAt,
      daysRemaining,
    });
  };

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
        window.history.replaceState({}, document.title, url.toString());
      }, 3000);
    }
  }, []);

  // Show banner for trialing, active subscriptions, or expired trials
  if (loading || !trialStatus) {
    return null;
  }

  // Don't show for canceled, past_due, etc. unless it's a trialing status
  if (
    !trialStatus.isTrialing &&
    trialStatus.subscriptionStatus !== "active" &&
    trialStatus.subscriptionStatus !== "trialing"
  ) {
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

  // Render trial status banner
  if (trialStatus.isTrialing) {
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

  // Render plan status banner (active subscription or expired trial)
  const isActiveSubscription = trialStatus.subscriptionStatus === "active";

  return (
    <div
      className={`bg-gradient-to-r ${isActiveSubscription ? "from-green-50 to-emerald-50 border-green-200" : "from-red-50 to-orange-50 border-red-200"} border rounded-lg p-4 mb-6`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isActiveSubscription ? (
              <div className="h-5 w-5 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            ) : (
              <div className="h-5 w-5 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">⚠</span>
              </div>
            )}
            <span
              className={`font-semibold ${isActiveSubscription ? "text-green-900" : "text-red-900"}`}
            >
              {getTierDisplayName(trialStatus.tier)} Plan
            </span>
          </div>

          <Badge
            className={`${isActiveSubscription ? "bg-green-500" : "bg-red-500"} text-white font-medium`}
          >
            {isActiveSubscription ? "Active" : "Trial Expired"}
          </Badge>
        </div>
      </div>

      <div className={`mt-2 text-sm ${isActiveSubscription ? "text-green-700" : "text-red-700"}`}>
        {isActiveSubscription
          ? `You're currently on the ${getTierDisplayName(trialStatus.tier)} plan with full access to all features.`
          : `Your ${getTierDisplayName(trialStatus.tier)} trial has expired. Upgrade to continue using all features.`}
      </div>
    </div>
  );
}
