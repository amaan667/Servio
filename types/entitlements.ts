export type KDSMode = "single" | "multi" | "enterprise" | null;
export type AnalyticsLevel = "basic" | "advanced" | "enterprise";
export type BrandingLevel = "basic" | "full" | "white_label";
export type ApiLevel = "light" | "full" | null;
export type SupportLevel = "email" | "priority" | "sla";
export type Tier = "starter" | "pro" | "enterprise";

export interface VenueEntitlements {
  tier: string;
  maxStaff: number | null;
  maxTables: number | null;
  maxLocations: number | null;
  kds: { enabled: boolean; mode: KDSMode };
  analytics: { level: AnalyticsLevel; csvExport: boolean; financeExport: boolean };
  branding: { level: BrandingLevel; customDomain: boolean };
  api: { enabled: boolean; level: ApiLevel };
  support: { level: SupportLevel };
}

export interface EntitlementCheckResult {
  allowed: boolean;
  message?: string;
  requiredTier?: string;
  currentTier?: string;
}

export interface MaxCountCheckResult {
  allowed: boolean;
  limit: number | null;
  currentTier: string;
  message?: string;
}

export interface VenueAddon {
  id: string;
  venue_id: string;
  addon_key: string; // e.g., 'kds_starter', 'api_pro_light'
  status: "active" | "cancelled" | "expired";
  stripe_subscription_item_id?: string | null;
  stripe_price_id?: string | null;
  created_at?: string;
  updated_at?: string;
}
