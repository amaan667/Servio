/**
 * Venue Entity Types
 */

export type SubscriptionTier = 
  | 'FREE'
  | 'BASIC'
  | 'PRO'
  | 'ENTERPRISE';

export interface Venue {
  id: string;
  owner_id: string;
  organization_id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  font_size?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  subscription_tier: SubscriptionTier;
  is_grandfathered: boolean;
  subscription_status: 'active' | 'cancelled' | 'past_due';
  created_at: string;
  updated_at: string;
}

export interface CreateVenueRequest {
  organizationId: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface UpdateVenueRequest {
  venueId: string;
  updates: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    font_size?: string;
  };
}

export interface VenueSettings {
  venue_id: string;
  venue_name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  font_size: string;
  show_descriptions: boolean;
  show_prices: boolean;
  auto_theme_enabled: boolean;
}

