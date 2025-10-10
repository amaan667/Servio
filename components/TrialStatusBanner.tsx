"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/app/auth/AuthProvider";

interface TrialStatus {
  isTrialing: boolean;
  tier: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

export default function TrialStatusBanner() {
  const { user } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrialStatus() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        
        // Get user's organization and trial status
        const { data: userVenueRole, error: userVenueError } = await supabase
          .from('user_venue_roles')
          .select('organization_id, organizations(subscription_status, subscription_tier, trial_ends_at)')
          .eq('user_id', user.id)
          .single();

        if (userVenueError) {
          // Fallback: try direct organization lookup
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('subscription_status, subscription_tier, trial_ends_at')
            .eq('owner_id', user.id)
            .single();

          if (orgError) {
            console.log('[TRIAL DEBUG] No organization found');
            setLoading(false);
            return;
          }

          processTrialStatus(org);
        } else if (userVenueRole && userVenueRole.organizations) {
          processTrialStatus(userVenueRole.organizations);
        }

      } catch (error) {
        console.error('[TRIAL DEBUG] Error fetching trial status:', error);
      } finally {
        setLoading(false);
      }
    }

    function processTrialStatus(org: any) {
      const isTrialing = org.subscription_status === 'trialing';
      const tier = org.subscription_tier || 'basic';
      const trialEndsAt = org.trial_ends_at;
      
      let daysRemaining = null;
      if (isTrialing && trialEndsAt) {
        const endDate = new Date(trialEndsAt);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      setTrialStatus({
        isTrialing,
        tier,
        trialEndsAt,
        daysRemaining
      });
    }

    fetchTrialStatus();
  }, [user]);

  if (loading || !trialStatus || !trialStatus.isTrialing) {
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
