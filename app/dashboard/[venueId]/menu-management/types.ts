export interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  created_at: string;
  position?: number;
}

export interface DesignSettings {
  venue_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  font_size: string;
  font_size_numeric?: number;
  logo_size?: string;
  custom_heading?: string;
  auto_theme_enabled?: boolean;
  detected_primary_color?: string;
  detected_secondary_color?: string;
  show_descriptions: boolean;
  show_prices: boolean;
}

export type ActiveTab = 'manage' | 'design' | 'preview';
export type PreviewMode = 'pdf' | 'styled' | 'simple';

