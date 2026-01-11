/**
 * Shared Pricing Tiers Configuration
 * Used across: select-plan, upgrade-modal, settings, billing
 */

export interface PricingTier {

}

export const PRICING_TIERS: Record<string, PricingTier> = {

      "Up to 5 staff accounts",
      "Table management (up to 25 tables)",
      "Customer feedback & reviews",
      "Basic analytics dashboard & daily reports",
      "Logo + colour theme",
      "Email support",
      "KDS available as add-on",
    ],

  },

      "Up to 15 staff accounts",
      "Advanced KDS (multi-station)",
      "Table management (up to 100 tables)",
      "Up to 3 locations",
      "Customer feedback & reviews",
      "Inventory & stock management",
      "Loyalty & repeat customer tracking",
      "Advanced analytics & forecasting + CSV exports",
      "Full branding + custom subdomain",
      "Priority email & live chat",
    ],

  },

      "Unlimited staff accounts",
      "Enterprise KDS (multi-venue)",
      "Unlimited tables",
      "Unlimited locations",
      "Customer feedback & reviews",
      "Advanced inventory + supplier ordering",
      "Loyalty & repeat customer tracking",
      "Enterprise analytics suite & financial exports",
      "Full white-label + custom domains",
      "API access, webhooks & POS/accounting integrations",
      "24/7 phone support, SLA & account manager",
    ],

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
