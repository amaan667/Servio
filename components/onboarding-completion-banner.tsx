"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, TrendingUp, Users, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function OnboardingCompletionBanner() {
  const params = useParams();
  const venueId = params?.venueId as string;
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if onboarding was just completed
    const onboardingComplete = localStorage.getItem("onboarding_complete");
    const bannerDismissed = localStorage.getItem("onboarding_banner_dismissed");

    if (onboardingComplete === "true" && !bannerDismissed) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("onboarding_banner_dismissed", "true");
    setVisible(false);
    setDismissed(true);
  };

  if (!visible || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg p-6 mb-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
      </div>

      {/* Close Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-6 h-6" />
          <h2 className="text-2xl font-bold">🎉 You're Live!</h2>
        </div>
        <p className="text-purple-100 mb-4">
          Your venue is set up and ready to accept orders. Here are some next steps to get the most
          out of Servio:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Link href={venueId ? `/dashboard/${venueId}/analytics` : "/"}>
            <div className="bg-white/10 hover:bg-white/20 transition-colors rounded-lg p-4 cursor-pointer h-full">
              <TrendingUp className="w-8 h-8 mb-2" />
              <h3 className="font-semibold mb-1">View Analytics</h3>
              <p className="text-sm text-purple-100">Track your sales and performance</p>
            </div>
          </Link>

          <Link href={`/dashboard/${venueId}/qr-codes`}>
            <div className="bg-white/10 hover:bg-white/20 transition-colors rounded-lg p-4 cursor-pointer h-full">
              <QrCode className="w-8 h-8 mb-2" />
              <h3 className="font-semibold mb-1">Print QR Codes</h3>
              <p className="text-sm text-purple-100">Download codes for your tables</p>
            </div>
          </Link>

          <Link href={venueId ? `/dashboard/${venueId}/settings/staff` : "/"}>
            <div className="bg-white/10 hover:bg-white/20 transition-colors rounded-lg p-4 cursor-pointer h-full">
              <Users className="w-8 h-8 mb-2" />
              <h3 className="font-semibold mb-1">Invite Staff</h3>
              <p className="text-sm text-purple-100">Add team members to help</p>
            </div>
          </Link>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleDismiss}
            variant="secondary"
            className="bg-white text-purple-600 hover:bg-purple-50"
          >
            Got it, thanks!
          </Button>
        </div>
      </div>
    </div>
  );
}
