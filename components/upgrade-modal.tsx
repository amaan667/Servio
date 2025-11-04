"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { PRICING_TIERS } from "@/lib/pricing-tiers";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
  organizationId: string;
}

export function UpgradeModal({
  open,
  onOpenChange,
  currentTier = "basic",
  organizationId,
}: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: string) => {
    setLoading(tier);

    try {
      // Create checkout session
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, organizationId }),
      });

      const { sessionId, url } = await response.json();

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else if (sessionId) {
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId });
          if (error) {
            // Empty block
          }
        }
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose the plan that's right for your business. All plans include a 14-day free trial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {Object.entries(PRICING_TIERS).map(([tierKey, tier]) => {
            const isCurrentTier = tierKey === currentTier;
            const canUpgrade = tierKey !== currentTier;

            return (
              <Card
                key={tierKey}
                className={`relative ${
                  "popular" in tier && tier.popular ? "border-2 border-purple-500 shadow-lg" : ""
                }`}
              >
                {"popular" in tier && tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-500 hover:bg-purple-600">Most Popular</Badge>
                  </div>
                )}

                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-semibold mb-2">{tier.name}</h3>
                    <div className="text-3xl font-bold mb-4">
                      {tier.price}
                      <span className="text-lg font-normal text-muted-foreground">/month</span>
                    </div>

                    {isCurrentTier ? (
                      <Badge variant="outline" className="mb-4">
                        Current Plan
                      </Badge>
                    ) : canUpgrade ? (
                      <Button
                        onClick={() => handleUpgrade(tierKey)}
                        disabled={loading !== null}
                        className="w-full mb-4"
                        variant={"popular" in tier && tier.popular ? "default" : "outline"}
                      >
                        {loading === tierKey ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Upgrade to {tier.name}
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>

                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            🎉 <strong>14-day free trial</strong> on all plans. No credit card required. Cancel
            anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
