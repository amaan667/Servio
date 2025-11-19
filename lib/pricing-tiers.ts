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
    description: "Perfect for small cafes and restaurants",
    features: [
      "QR code ordering system",
      "Up to 3 staff accounts",
      "Basic analytics dashboard",
      "Table management (up to 20 tables)",
      "Email support",
    ],
    popular: false,
  },
  pro: {
    name: "Pro",
    price: "£249",
    priceNumeric: 249,
    description: "Ideal for growing businesses",
    features: [
      "QR code ordering system",
      "Up to 10 staff accounts",
      "Advanced analytics & AI insights",
      "Table management (up to 50 tables)",
      "Customer feedback system",
      "Inventory management",
      "Priority email support",
    ],
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    price: "£449+",
    priceNumeric: 449,
    description: "For established restaurants & chains",
    features: [
      "QR code ordering system",
      "Unlimited staff accounts",
      "Advanced analytics + exports",
      "Unlimited tables",
      "Customer feedback system",
      "Inventory management",
      "Multi-location support",
      "Custom branding",
      "Kitchen Display System (KDS)",
      "API access",
      "24/7 priority support",
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
