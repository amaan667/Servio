"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink, Sparkles, Users } from "lucide-react";
import OnboardingProgress from "@/components/onboarding-progress";
import { createClient } from "@/lib/supabase";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/use-mobile";

export default function OnboardingTestOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const windowSize = useWindowSize();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      // Get venue
      const { data: venues } = await supabase
        .from("venues")
        .select("venue_id, name")
        .eq("owner_user_id", user.id)
        .limit(1);

      if (!venues || venues.length === 0) {
        setLoading(false);
        return;
      }

      setVenueId(venues[0]?.venue_id);
      setLoading(false);
    } catch (_error) {
      setLoading(false);
    }
  };

  const [checkingOrder, setCheckingOrder] = useState(false);

  useEffect(() => {
    // Poll for orders if customer view is open
    if (venueId && !orderCompleted) {
      const interval = setInterval(async () => {
        try {
          const supabase = await createClient();
          const { data: orders } = await supabase
            .from("orders")
            .select("id, order_status, payment_status, created_at")
            .eq("venue_id", venueId)
            .eq("order_status", "PLACED")
            .order("created_at", { ascending: false })
            .limit(1);

          if (orders && orders.length > 0) {
            const recentOrder = orders[0];
            const orderAge = Date.now() - new Date(recentOrder.created_at).getTime();
            // If order was created in last 5 minutes, consider it a test order
            if (orderAge < 5 * 60 * 1000) {
              setOrderCompleted(true);
              setShowConfetti(true);
              localStorage.setItem("onboarding_complete", "true");
              localStorage.setItem("onboarding_step", "4");
              import("@/lib/onboarding-progress").then(({ saveOnboardingProgress }) =>
                saveOnboardingProgress(4, [1, 2, 3, 4], { test_order_complete: true })
              );
              clearInterval(interval);
              setTimeout(() => setShowConfetti(false), 5000);
            }
          }
        } catch (_error) {
          // Silently handle errors
        }
      }, 2000); // Check every 2 seconds

      return () => clearInterval(interval);
    }
  }, [venueId, orderCompleted]);

  const handleOpenCustomerView = () => {
    if (!venueId) return;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
    const orderUrl = `${baseUrl}/order?venue=${venueId}&table=1`;

    // Open in new tab
    window.open(orderUrl, "_blank");
    setCheckingOrder(true);
  };

  const handleCompleteLater = async () => {
    localStorage.setItem("onboarding_step", "3");

    // Ensure organization/venue are created before going to dashboard
    if (!venueId) {
      try {
        const response = await fetch("/api/signup/complete-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();
        if (response.ok && data.success && data.venueId) {
          router.push(`/dashboard/${data.venueId}`);
          return;
        }
      } catch (_error) {
        // If API fails, still try to redirect
      }
    }

    if (venueId) {
      router.push(`/dashboard/${venueId}`);
    } else {
      router.push("/");
    }
  };

  const handleGoToDashboard = async () => {
    localStorage.setItem("onboarding_complete", "true");

    // Ensure organization/venue are created before going to dashboard
    if (!venueId) {
      try {
        const response = await fetch("/api/signup/complete-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();
        if (response.ok && data.success && data.venueId) {
          router.push(`/dashboard/${data.venueId}`);
          return;
        }
      } catch (_error) {
        // If API fails, still try to redirect
      }
    }

    if (venueId) {
      router.push(`/dashboard/${venueId}`);
    } else {
      router.push("/");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
        />
      )}

      <OnboardingProgress currentStep={4} />

      {!orderCompleted ? (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Sparkles className="w-6 h-6 mr-2 text-purple-600" />
              Let's test your setup!
            </CardTitle>
            <CardDescription className="text-base">
              Experience what your customers will see when they scan a QR code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">What to expect:</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <span className="mr-2">1.</span>
                  <span>Click "Open Customer View" to see your menu as a customer would</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">2.</span>
                  <span>Browse your menu and add items to the cart</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">3.</span>
                  <span>Complete the checkout using Stripe's test mode</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">4.</span>
                  <span>See your order appear in real-time on the dashboard</span>
                </li>
              </ul>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleOpenCustomerView}
              disabled={checkingOrder}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white h-14 text-lg"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              {checkingOrder ? "Waiting for order..." : "Open Customer View"}
            </Button>

            {checkingOrder && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Waiting for order...</strong> Place a test order in the customer view
                  window. We'll detect it automatically.
                </p>
              </div>
            )}

            {/* Test Card Details */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2">💳 Test Card Details:</h4>
              <div className="text-sm text-green-800 space-y-1">
                <p>
                  <strong>Card Number:</strong> 4242 4242 4242 4242
                </p>
                <p>
                  <strong>Expiry:</strong> Any future date
                </p>
                <p>
                  <strong>CVC:</strong> Any 3 digits
                </p>
                <p className="text-xs mt-2 text-green-700">
                  This is Stripe's test card - no real charges will be made
                </p>
              </div>
            </div>

            {/* Skip Button */}
            <div className="pt-4 border-t">
              <Button variant="ghost" onClick={handleCompleteLater} className="w-full">
                I'll Test This Later
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-green-300 bg-gradient-to-br from-white to-green-50">
          <CardHeader>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <CardTitle className="text-3xl">🎉 Setup Complete!</CardTitle>
              <CardDescription className="text-lg mt-2">
                Your venue is now live and ready to accept orders!
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Success Summary */}
            <div className="bg-white border-2 border-green-200 rounded-lg p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">What you've accomplished:</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Menu uploaded</div>
                    <div className="text-sm text-gray-600">Your items are ready for customers</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Tables & QR codes generated</div>
                    <div className="text-sm text-gray-600">Customers can scan to order</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Test order completed</div>
                    <div className="text-sm text-gray-600">You've seen the customer experience</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-2">🚀 Suggested next steps:</h4>
              <ul className="space-y-2 text-sm text-purple-800">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Check your Analytics dashboard to see insights</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Download and print your QR codes</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Invite staff members to help manage orders</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Customize your menu with images and descriptions</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleGoToDashboard}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-lg"
              >
                Go to Dashboard
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(venueId ? `/dashboard/${venueId}/analytics` : "/dashboard")
                  }
                  className="w-full"
                >
                  📊 View Analytics
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(venueId ? `/dashboard/${venueId}/settings/staff` : "/dashboard")
                  }
                  className="w-full"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Invite Staff
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
