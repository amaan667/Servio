// Comprehensive database table types - matches actual Supabase schema

export interface Venue {

}

export interface Order {

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

}

export interface Table {

}

export interface KDSStation {

}

export interface KDSTicket {
  id?: string;

}

export interface FeedbackQuestion {

}

export interface FeedbackResponse {
  id?: string;

}

export interface Organization {

}

export interface UserVenueRole {
  id?: string;

}

export interface StaffInvitation {
  id?: string;

}

export interface InventoryItem {
  id?: string;

}

export interface TableSession {

}

// Supabase client type
export interface SupabaseClient {

  };

    getUser: () => Promise<{ data: { user: unknown }; error: unknown }>;
    getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
  };

  rpc: (fn: string, params?: unknown) => unknown;

}
