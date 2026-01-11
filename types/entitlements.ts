export type KDSMode = 'single' | 'multi' | 'enterprise' | null;
export type AnalyticsLevel = 'basic' | 'advanced' | 'enterprise';
export type BrandingLevel = 'basic' | 'full' | 'white_label';
export type ApiLevel = 'light' | 'full' | null;
export type SupportLevel = 'email' | 'priority' | 'sla';
export type Tier = 'starter' | 'pro' | 'enterprise';

export interface VenueEntitlements {

  kds: { enabled: boolean; mode: KDSMode };
  analytics: { level: AnalyticsLevel; csvExport: boolean; financeExport: boolean };
  branding: { level: BrandingLevel; customDomain: boolean };
  api: { enabled: boolean; level: ApiLevel };
  support: { level: SupportLevel };
}

export interface EntitlementCheckResult {

}

export interface MaxCountCheckResult {

}

export interface VenueAddon {

  addon_key: string; // e.g., 'kds_starter', 'api_pro_light'

}