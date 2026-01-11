"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Calendar } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [tier, setTier] = useState<string>("");
  const [trialEndsAt, setTrialEndsAt] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const redirectToDashboard = async () => {
      if (!user) {
        router.push("/");
        return;
      }

      const supabase = supabaseBrowser();
      const { data: venues, error } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (!error && venues && venues.length > 0) {
        const primaryVenue = venues[0];
        if (primaryVenue) {
          router.push(`/dashboard/${primaryVenue.venue_id}`);
        } else {
          router.push("/");
        }
      } else {
        router.push("/");
      }
    };

    if (!searchParams) {
      redirectToDashboard();
      return;
    }

    const sessionId = searchParams.get("session_id");
    const tierParam = searchParams.get("tier");

    if (sessionId && tierParam) {
      setTier(tierParam);

      // Calculate trial end date (14 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      setTrialEndsAt(trialEndDate.toLocaleDateString());

      // Update organization tier immediately as a backup in case webhook hasn't fired yet
      if (user) {
        // Retry logic for organization update
        const updateOrganization = async (retryCount = 0) => {
          try {
            const response = await fetch("/api/test/update-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tier: tierParam }),
            });

            await response.json();

            if (!response.ok && retryCount < 3) {
              setTimeout(() => updateOrganization(retryCount + 1), (retryCount + 1) * 2000);
            }
          } catch {
            if (retryCount < 3) {
              setTimeout(() => updateOrganization(retryCount + 1), (retryCount + 1) * 2000);
            }
          }
        };

        updateOrganization();
      }

      setLoading(false);
    } else {
      // Redirect if missing required params

      redirectToDashboard();
    }
  }, [searchParams, router, user]);

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case "starter":
        return "Starter Plan";
      case "pro":
        return "Pro Plan";
      case "enterprise":
        return "Enterprise Plan";
      default:
        return "Your Plan";
    }
  };

  const getTierPrice = (tier: string) => {
    switch (tier) {
      case "starter":
        return "£99";
      case "pro":
        return "£249";
      case "enterprise":
        return "£449";
      default:
        return "£0";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-3xl font-bold text-green-600">
            🎉 Welcome to {getTierDisplayName(tier)}!
          </CardTitle>
          <p className="text-lg text-gray-600 mt-2">
            Your subscription has been activated successfully
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Trial Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="h-6 w-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">Free Trial Active</h3>
            </div>
            <div className="space-y-2">
              <p className="text-blue-800">
                <strong>You&apos;re now enjoying a 14-day free trial!</strong>
              </p>
              <div className="flex items-center gap-2 text-blue-700">
                <Calendar className="h-4 w-4" />
                <span>Trial ends on: {trialEndsAt}</span>
              </div>
              <p className="text-sm text-blue-600">
                Your card will be charged {getTierPrice(tier)}/month starting after your trial ends.
              </p>
            </div>
          </div>

          {/* Plan Details */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Your Plan Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Plan:</span>
                <Badge className="bg-purple-500 text-white">{getTierDisplayName(tier)}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Monthly Price:</span>
                <span className="font-semibold">{getTierPrice(tier)}/month</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge className="bg-green-500 text-white">Free Trial</Badge>
              </div>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">What&apos;s Next?</h3>
            <ul className="space-y-2 text-green-800">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Access your full dashboard with all {getTierDisplayName(tier)} features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Set up your restaurant tables and menu items</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Start accepting QR code orders from customers</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Enjoy your 14-day free trial - no charges until {trialEndsAt}</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={async () => {
                // Add a small delay to ensure the organization update has time to propagate
                setTimeout(async () => {
                  if (user) {
                    const supabase = supabaseBrowser();
                    const { data: venues, error } = await supabase
                      .from("venues")
                      .select("venue_id")
                      .eq("owner_user_id", user.id)
                      .order("created_at", { ascending: true })
                      .limit(1);

                    if (!error && venues && venues.length > 0) {
                      const primaryVenue = venues[0];
                      if (primaryVenue) {
                        router.push(`/dashboard/${primaryVenue.venue_id}?upgrade=success`);
                      } else {
                        router.push("/");
                      }
                    } else {
                      router.push("/");
                    }
                  } else {
                    router.push("/");
                  }
                }, 1000);
              }}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Add a small delay to ensure the organization update has time to propagate
                setTimeout(() => {
                  router.push("/?upgrade=success");
                }, 1000);
              }}
              className="flex-1"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
