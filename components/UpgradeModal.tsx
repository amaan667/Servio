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

    console.log('[UPGRADE DEBUG] Starting upgrade with:', {
      tierId,
      currentTier,
      organizationId
    });

    try {
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
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("Failed to start upgrade. Please try again.");
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription>
            {currentTier === "basic" || currentTier === "standard"
              ? "Upgrade to unlock more features and grow your business"
              : "Select the plan that works best for your business"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const isCurrent = tier.id === currentTier;
            const isDowngrade =
              (currentTier === "standard" && tier.id === "basic") ||
              (currentTier === "premium" && tier.id !== "premium");

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col p-6 ${
                  tier.popular
                    ? "border-2 border-purple-500 shadow-lg scale-105"
                    : ""
                } ${isCurrent ? "bg-gray-50" : ""}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500">
                    Most Popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500">
                    Current Plan
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                  <div className="text-4xl font-bold mb-2">
                    {tier.price}
                    <span className="text-lg font-normal text-gray-600">
                      {tier.period}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{tier.description}</p>
                </div>

                <ul className="space-y-3 mb-6 flex-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                  {tier.notIncluded &&
                    tier.notIncluded.map((feature, idx) => (
                      <li
                        key={`not-${idx}`}
                        className="flex items-start gap-2 text-gray-400"
                      >
                        <span className="text-sm">✗ {feature}</span>
                      </li>
                    ))}
                </ul>

                <Button
                  variant={tier.popular ? "servio" : "outline"}
                  className="w-full"
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={
                    isCurrent || isDowngrade || loading === tier.id || !!loading
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
                    "Contact Support to Downgrade"
                  ) : (
                    "Select Plan"
                  )}
                </Button>

                {tier.id !== "premium" && !isCurrent && (
                  <p className="text-xs text-center text-gray-500 mt-3">
                    14-day free trial • First billing after trial
                  </p>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>✨ Free Trial:</strong> All plans include a 14-day free
            trial. Your card will only be charged after the trial ends. Cancel
            anytime during the trial at no cost.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

