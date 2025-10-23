// Comprehensive database table types - matches actual Supabase schema

export interface Venue {
  venue_id: string;
  venue_name: string;
  owner_user_id: string;
  organization_id?: string; // Links to parent organization for billing
  timezone?: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  // Deprecated: subscription fields moved to organizations table
  subscription_tier?: string; // Legacy field - prefer organization.subscription_tier
  trial_ends_at?: string; // Legacy field - prefer organization.trial_ends_at
}

export interface Order {
  id: string;
  venue_id: string;
  table_number?: string | null;
  table_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  items?: OrderItem[];
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
  order_status?: string;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  payment_mode?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  id?: string;
  item_name?: string;
  name?: string;
  quantity?: number | string;
  price?: number;
  total?: number;
  specialInstructions?: string;
  special_instructions?: string;
  modifiers?: unknown[];
}

export interface MenuItem {
  id: string;
  venue_id: string;
  name_en?: string;
  name_ar?: string;
  name?: string;
  description_en?: string;
  description_ar?: string;
  price?: number;
  category?: string;
  is_available?: boolean;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Table {
  id: string;
  venue_id: string;
  table_number?: string;
  label?: string;
  seat_count: number;
  status?: string;
  qr_code_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KDSStation {
  id: string;
  venue_id: string;
  station_name: string;
  station_type?: string;
  is_active?: boolean;
  display_order?: number;
  color?: string;
  created_at?: string;
}

export interface KDSTicket {
  id?: string;
  venue_id: string;
  order_id: string;
  station_id: string;
  item_name: string;
  quantity: number;
  special_instructions?: string | null;
  table_number?: string | null;
  table_label?: string;
  status: "new" | "in_progress" | "completed" | "cancelled";
  created_at?: string;
  completed_at?: string | null;
}

export interface FeedbackQuestion {
  id: string;
  venue_id: string;
  type: "stars" | "multiple_choice" | "text";
  prompt: string;
  choices?: string[];
  is_active?: boolean;
  created_at?: string;
}

export interface FeedbackResponse {
  id?: string;
  venue_id: string;
  order_id?: string | null;
  question_id: string;
  type: "stars" | "multiple_choice" | "text";
  answer_stars?: number;
  answer_choice?: string;
  answer_text?: string;
  created_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string; // The actual column name in database (user who created org)
  owner_user_id?: string; // Added column for compatibility
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_tier?: string;
  subscription_status?: string;
  trial_ends_at?: string | null;
  billing_email?: string;
  is_grandfathered?: boolean;
  subscription_plan?: string;
  subscription_current_period_start?: string;
  subscription_current_period_end?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserVenueRole {
  id?: string;
  user_id: string;
  venue_id: string;
  role: "owner" | "manager" | "staff";
  created_at?: string;
}

export interface StaffInvitation {
  id?: string;
  venue_id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "cancelled";
  invited_by: string;
  created_at?: string;
  expires_at?: string;
}

export interface InventoryItem {
  id?: string;
  venue_id: string;
  name: string;
  sku?: string;
  unit: string;
  cost_per_unit: number;
  on_hand: number;
  par_level: number;
  reorder_level: number;
  supplier?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TableSession {
  id: string;
  venue_id: string;
  table_id?: string;
  table_number?: string;
  status?: string;
  started_at?: string;
  ended_at?: string | null;
  total_amount?: number;
  payment_status?: string;
}

// Supabase client type
export interface SupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    insert: (data: unknown) => unknown;
    update: (data: unknown) => unknown;
    delete: () => unknown;
    upsert: (data: unknown) => unknown;
  };
  auth: {
    getUser: () => Promise<{ data: { user: unknown }; error: unknown }>;
    getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
  };
  storage: unknown;
  rpc: (fn: string, params?: unknown) => unknown;
  channel: (name: string) => unknown;
}
