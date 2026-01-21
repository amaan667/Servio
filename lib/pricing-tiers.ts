/**
 * Shared Pricing Tiers Configuration
 * Used across: select-plan, upgrade-modal, settings, billing
 */

export interface PricingTier {
  name: string;
  price: string;
  priceNumeric: number; // For calculations/comparisons
  description: string;
  features: string[];
  popular?: boolean;
}

export const PRICING_TIERS: Record<string, PricingTier> = {
  starter: {
    name: "Starter",
    price: "£99",
    priceNumeric: 99,
    description: "Food trucks & micro venues",
    features: [
      "Up to 5 tables",
      "Up to 3 staff accounts",
      "1 location",
      "QR ordering (tables + counter)",
      "Menu, categories & modifiers",
      "Pay Now, Pay Later & Pay at Till",
      "Live orders feed for staff",
      "Basic analytics (sales + order volume)",
      "Email support",
    ],
    popular: false,
  },
  pro: {
    name: "Pro",
    price: "£249",
    priceNumeric: 249,
    description: "Busy cafés & restaurants",
    features: [
      "Up to 3 locations",
      "Up to 15 staff accounts",
      "Up to 40 tables",
      "Kitchen Display System (multi-station)",
      "Prep routing (coffee / kitchen / bar)",
      "Service states: Preparing → Ready → Served → Complete",
      "Payments page for Pay at Till confirmations",
      "Advanced analytics + CSV exports",
      "Priority email & live chat support",
    ],
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    price: "£499+",
    priceNumeric: 499,
    description: "Groups, large venues, complex ops",
    features: [
      "Unlimited locations, staff & tables",
      "Centralised menu governance (publish control)",
      "Roles, permissions & audit trails",
      "API access + custom integrations",
      "White-label options (brand + domains)",
      "Cross-location reporting (group view)",
      "Dedicated onboarding + SLA options",
      "Account manager + priority support",
    ],
    popular: false,
  },
};

/**
 * Get tier display name with proper capitalization
 */
export function getTierDisplayName(tier: string): string {
  const tierKey = tier.toLowerCase();
  return PRICING_TIERS[tierKey]?.name || tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Get tier order for comparison (starter = 1, pro = 2, enterprise = 3)
 */
export function getTierLevel(tier: string): number {
  const tierOrder: Record<string, number> = { starter: 1, pro: 2, enterprise: 3 };
  return tierOrder[tier.toLowerCase()] || 0;
}

/**
 * Check if tierA is higher than tierB
 */
export function isTierHigher(tierA: string, tierB: string): boolean {
  return getTierLevel(tierA) > getTierLevel(tierB);
}

/**
 * Check if tierA is lower than tierB
 */
export function isTierLower(tierA: string, tierB: string): boolean {
  return getTierLevel(tierA) < getTierLevel(tierB);
}
