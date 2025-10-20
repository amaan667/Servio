"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
  organizationId?: string;
}

export function UpgradeModal({
  open,
  onOpenChange,
  currentTier = "basic",
  organizationId,
}: UpgradeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const tiers = [
    {
      name: "Basic",
      id: "basic",
      price: "£99",
      period: "/month",
      description: "Perfect for small cafes and restaurants",
      features: [
        "Up to 10 tables",
        "50 menu items max",
        "3 staff members",
        "QR ordering",
        "Order tracking",
        "Basic analytics",
      ],
      notIncluded: ["KDS", "Inventory", "AI Assistant"],
    },
    {
      name: "Standard",
      id: "standard",
      price: "£249",
      period: "/month",
      description: "Most popular for growing businesses",
      popular: true,
      features: [
        "Up to 20 tables",
        "200 menu items max",
        "10 staff members",
        "Everything in Basic, plus:",
        "Kitchen Display System (KDS)",
        "Inventory management",
        "Advanced analytics",
        "Priority support",
      ],
      notIncluded: ["AI Assistant", "Multi-venue"],
    },
    {
      name: "Premium",
      id: "premium",
      price: "£449+",
      period: "/month",
      description: "Unlimited power for enterprises",
      features: [
        "Unlimited tables",
        "Unlimited menu items",
        "Unlimited staff",
        "Unlimited venues",
        "Everything in Standard, plus:",
        "AI Assistant (13 tools)",
        "Multi-venue management",
        "Custom integrations",
        "Dedicated account manager",
      ],
      contact: true,
    },
  ];

  const handleUpgrade = async (tierId: string) => {
    if (tierId === "premium") {
      // Premium requires contacting sales
      window.location.href = "mailto:sales@servio.app?subject=Premium Plan Inquiry";
      return;
    }

    if (tierId === currentTier) {
      onOpenChange(false);
      return;
    }

    setLoading(tierId);

    try {
      // For downgrades (to Basic), we need to handle it differently
      const isDowngrade = (currentTier === "standard" && tierId === "basic") ||
                         (currentTier === "premium" && tierId !== "premium");

      if (isDowngrade) {
        // For downgrades to Basic, handle immediately
        if (tierId === "basic") {
          const response = await fetch("/api/stripe/downgrade-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              organizationId, 
              newTier: "basic" 
            }),
          });

          const data = await response.json();

          if (data.error) {
            alert(data.error);
            setLoading(null);
            return;
          }

          if (data.success) {
            alert("Successfully switched to Basic plan! Your next billing cycle will reflect the new pricing.");
            onOpenChange(false);
            // Refresh the page to show updated plan
            window.location.reload();
          }
        } else {
          // For other downgrades, use the billing portal
          const response = await fetch("/api/stripe/create-portal-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId }),
          });

          const data = await response.json();

          if (data.error) {
            alert(data.error);
            setLoading(null);
            return;
          }

          if (data.url) {
            window.location.href = data.url;
          }
        }
      } else {
        // For upgrades, use the normal checkout flow
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier: tierId,
            organizationId,
          }),
        });

        const data = await response.json();

        if (data.error) {
          alert(data.error);
          setLoading(null);
          return;
        }

        // Redirect to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        }
      }
    } catch (error) {

      alert("Failed to change plan. Please try again.");
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-3 sm:p-4 md:p-6">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-bold">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm md:text-base">
            {currentTier === "basic" || currentTier === "standard"
              ? "Upgrade to unlock more features and grow your business"
              : "Select the plan that works best for your business"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mt-4 sm:mt-6 max-w-6xl mx-auto px-1 sm:px-2 md:px-4">
          {tiers.map((tier) => {
            const isCurrent = tier.id === currentTier;
            const isDowngrade =
              (currentTier === "standard" && tier.id === "basic") ||
              (currentTier === "premium" && tier.id !== "premium");
            
            const isUpgrade =
              (currentTier === "basic" && tier.id === "standard") ||
              (currentTier === "standard" && tier.id === "premium");

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col p-3 sm:p-4 md:p-6 h-full min-h-[380px] sm:min-h-[420px] md:min-h-[450px] ${
                  isCurrent
                    ? "border-2 border-green-500 bg-green-50 shadow-lg"
                    : tier.popular
                    ? "border-2 border-purple-500 shadow-lg"
                    : "border border-gray-200 hover:shadow-md transition-shadow"
                }`}
              >
                {isCurrent ? (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs sm:text-sm">
                    Current Plan
                  </Badge>
                ) : tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs sm:text-sm">
                    Most Popular
                  </Badge>
                )}

                <div className="text-center mb-3 sm:mb-4 md:mb-6">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">{tier.name}</h3>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                    {tier.price}
                    <span className="text-sm sm:text-base md:text-lg font-normal text-gray-900">
                      {tier.period}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-900">{tier.description}</p>
                </div>

                <ul className="space-y-1 sm:space-y-2 md:space-y-3 mb-3 sm:mb-4 md:mb-6 flex-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                  {tier.notIncluded &&
                    tier.notIncluded.map((feature, idx) => (
                      <li
                        key={`not-${idx}`}
                        className="flex items-start gap-2 text-gray-500"
                      >
                        <span className="text-xs sm:text-sm">✗ {feature}</span>
                      </li>
                    ))}
                </ul>

                <div className="mt-auto space-y-2">
                  <Button
                    variant={isCurrent ? "outline" : tier.popular ? "servio" : "outline"}
                    className="w-full text-sm sm:text-base"
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={
                      isCurrent || loading === tier.id || !!loading
                    }
                  >
                    {loading === tier.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : tier.contact ? (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Contact Sales
                      </>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : isDowngrade ? (
                      "Switch to Basic"
                    ) : isUpgrade ? (
                      "Upgrade Now"
                    ) : (
                      "Select Plan"
                    )}
                  </Button>

                  {tier.id !== "premium" && !isCurrent && (
                    <p className="text-xs text-center text-gray-700 px-2">
                      14-day free trial • First billing after trial
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-3 sm:mt-4 md:mt-6 p-2 sm:p-3 md:p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs sm:text-sm text-blue-900 text-center">
            <strong>✨ Free Trial:</strong> All plans include a 14-day free
            trial. Your card will only be charged after the trial ends. Cancel
            anytime during the trial at no cost.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

