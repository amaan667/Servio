"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  if (userRole && userRole !== 'owner') {
    return null;
  }

  const fetchTrialStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Use the organization ensure endpoint to get accurate organization data (non-blocking)
      let ensureOrgResponse;
      try {
        ensureOrgResponse = await fetch('/api/organization/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!ensureOrgResponse.ok) {
          console.error('Failed to ensure organization (non-critical)');
          setLoading(false);
          return;
        }
      } catch (orgError) {
        console.error('Organization ensure error (non-critical):', orgError);
        setLoading(false);
        return;
      }

      const { organization } = await ensureOrgResponse.json();
      
      if (organization) {
        processTrialStatus({
          subscription_status: organization.subscription_status,
          subscription_tier: organization.subscription_tier,
          trial_ends_at: organization.trial_ends_at
        });
      }

    } catch (error) {
      console.error('Error fetching trial status:', error);
    } finally {
      setLoading(false);
    }
  };

  const processTrialStatus = (org: any) => {
    const subscriptionStatus = org.subscription_status || 'basic';
    const isTrialing = subscriptionStatus === 'trialing';
    const tier = org.subscription_tier || 'basic';
    const trialEndsAt = org.trial_ends_at;
    
    let daysRemaining = null;
    if (isTrialing && trialEndsAt) {
      const endDate = new Date(trialEndsAt);
      const now = new Date();
      
      // Set both dates to start of day for accurate day counting
      const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const diffTime = endDateStart.getTime() - nowStart.getTime();
      // Use Math.floor to get exact days remaining (not rounded up)
      daysRemaining = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // Ensure we don't show negative days
      daysRemaining = Math.max(0, daysRemaining);
    }

    setTrialStatus({
      isTrialing,
      subscriptionStatus,
      tier,
      trialEndsAt,
      daysRemaining
    });
  };

  useEffect(() => {
    if (user) {
      console.debug('[TRIAL BANNER] Fetching trial status for user:', user.id);
      fetchTrialStatus();
    } else {
      console.debug('[TRIAL BANNER] No user, clearing trial status');
      setTrialStatus(null);
      setLoading(false);
    }
  }, [user]);

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
      console.debug('[TRIAL BANNER] Daily refresh - updating trial countdown');
      fetchTrialStatus();
      
      // Set up recurring daily refresh
      const dailyInterval = setInterval(() => {
        console.debug('[TRIAL BANNER] Daily refresh - updating trial countdown');
        fetchTrialStatus();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
      // Clean up interval on unmount
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, [user, trialStatus?.isTrialing]);

  // Hourly refresh to catch any edge cases
  useEffect(() => {
    if (!user || !trialStatus?.isTrialing) return;

    const hourlyInterval = setInterval(() => {
      console.debug('[TRIAL BANNER] Hourly refresh - updating trial countdown');
      fetchTrialStatus();
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(hourlyInterval);
  }, [user, trialStatus?.isTrialing]);

  // Auto-refresh when returning from checkout success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('upgrade') === 'success') {
      console.debug('[TRIAL BANNER] Detected upgrade success, starting refresh');
      
      // Refresh trial status after successful upgrade with retry logic
      const refreshWithRetry = async (attempt = 0) => {
        console.debug(`[TRIAL BANNER REFRESH] Attempt ${attempt + 1}/4`);
        
        try {
          // Directly fetch organization data
          const ensureOrgResponse = await fetch('/api/organization/ensure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!ensureOrgResponse.ok) {
            console.error('[TRIAL BANNER REFRESH] Failed to fetch organization');
            if (attempt < 3) {
              setTimeout(() => refreshWithRetry(attempt + 1), (attempt + 1) * 2000);
            }
            return;
          }

          const { organization } = await ensureOrgResponse.json();
          console.debug('[TRIAL BANNER REFRESH] Fetched organization:', {
            tier: organization.subscription_tier,
            status: organization.subscription_status,
            trial_ends_at: organization.trial_ends_at
          });
          
          // Process and update trial status
          if (organization) {
            processTrialStatus({
              subscription_status: organization.subscription_status,
              subscription_tier: organization.subscription_tier,
              trial_ends_at: organization.trial_ends_at
            });
            console.debug('[TRIAL BANNER REFRESH] Successfully updated trial status');
          } else if (attempt < 3) {
            // If no organization data, retry
            setTimeout(() => refreshWithRetry(attempt + 1), (attempt + 1) * 2000);
          }
        } catch (error) {
          console.error('[TRIAL BANNER REFRESH] Error:', error);
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
        url.searchParams.delete('upgrade');
        window.history.replaceState({}, document.title, url.toString());
        console.debug('[TRIAL BANNER] Removed upgrade parameter from URL');
      }, 3000);
    }
  }, []);

  // Only show for trialing or active subscriptions (hide for canceled, past_due, etc.)
  if (loading || !trialStatus || (!trialStatus.isTrialing && trialStatus.subscriptionStatus !== 'active')) {
    return null;
  }

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case "basic": return "Basic";
      case "standard": return "Standard";
      case "premium": return "Premium";
      default: return tier.charAt(0).toUpperCase() + tier.slice(1);
    }
  };

  const getTrialEndDate = (trialEndsAt: string) => {
    return new Date(trialEndsAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysRemainingColor = (days: number) => {
    if (days <= 3) return 'bg-red-500 text-white';
    if (days <= 7) return 'bg-orange-500 text-white';
    return 'bg-blue-500 text-white';
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
              <Badge className={`${getDaysRemainingColor(trialStatus.daysRemaining)} font-medium`}>
                {trialStatus.daysRemaining === 0 
                  ? "Last day of trial" 
                  : trialStatus.daysRemaining === 1 
                    ? "1 day remaining"
                    : `${trialStatus.daysRemaining} days remaining`
                }
              </Badge>
            )}
          </div>

          {trialStatus.trialEndsAt && (
            <div className="flex items-center gap-2 text-blue-700">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Trial ends {getTrialEndDate(trialStatus.trialEndsAt)}
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-2 text-sm text-blue-700">
          Enjoy full access to all {getTierDisplayName(trialStatus.tier)} features during your trial period.
          {trialStatus.daysRemaining !== null && trialStatus.daysRemaining <= 7 && (
            <span className="font-medium ml-1">
              Consider upgrading to continue without interruption.
            </span>
          )}
        </div>
      </div>
    );
  }

  // Render active subscription banner
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-900">
              {getTierDisplayName(trialStatus.tier)} Plan
            </span>
          </div>
          
          <Badge className="bg-green-500 text-white font-medium">
            Active
          </Badge>
        </div>
      </div>
      
      <div className="mt-2 text-sm text-green-700">
        You're currently on the {getTierDisplayName(trialStatus.tier)} plan with full access to all features.
      </div>
    </div>
  );
}
