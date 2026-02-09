/**
 * Database Types - Auto-generated type definitions for all database tables
 * This provides type-safe access to database rows and eliminates the need for 'as any'
 */

// ========================================
// CORE TABLES
// ========================================

export interface VenueRow {
  id: string;
  venue_id: string;
  venue_name: string;
  business_type: string;
  owner_user_id: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  country?: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  subscription_tier: "starter" | "pro" | "enterprise";
  trial_ends_at: string | null;
  daily_reset_time: string;
  last_reset_at: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

export interface UserVenueRoleRow {
  id: string;
  user_id: string;
  venue_id: string;
  role: "owner" | "manager" | "staff" | "server" | "kitchen";
  created_at: string;
  updated_at: string;
  permissions: Record<string, boolean>;
}

// ========================================
// TABLE & SESSION MANAGEMENT
// ========================================

export interface TableRow {
  id: string;
  venue_id: string;
  label: string;
  seats: number;
  section: string | null;
  status: "available" | "occupied" | "reserved" | "inactive";
  is_active: boolean;
  qr_code_url: string | null;
  merged_with_table_id: string | null;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
}

export interface TableSessionRow {
  id: string;
  venue_id: string;
  table_id: string;
  status: "active" | "closed" | "merged";
  started_at: string;
  ended_at: string | null;
  server_id: string | null;
  guest_count: number;
  notes: string | null;
  total_amount: number;
  is_merged_into: string | null;
  created_at: string;
  updated_at: string;
}

export interface CounterSessionRow {
  id: string;
  venue_id: string;
  counter_id: string;
  status: "active" | "closed";
  started_at: string;
  ended_at: string | null;
  server_id: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ReservationRow {
  id: string;
  venue_id: string;
  table_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  start_at: string;
  end_at: string;
  party_size: number;
  status: "pending" | "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  special_requests: string | null;
  created_at: string;
  updated_at: string;
}

// ========================================
// ORDER MANAGEMENT
// ========================================

export interface OrderRow {
  id: string;
  venue_id: string;
  table_id: string | null;
  counter_id: string | null;
  order_number: string;
  status: "pending" | "in_prep" | "ready" | "served" | "completed" | "cancelled";
  order_type: "dine_in" | "takeaway" | "delivery";
  items: OrderItem[];
  subtotal: number;
  tax: number;
  tip: number | null;
  total: number;
  payment_status: "unpaid" | "paid" | "refunded" | "partial";
  payment_method: "card" | "cash" | "other" | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  preparation_time: number | null;
  assigned_to: string | null;
  stripe_payment_intent_id: string | null;
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  special_instructions: string | null;
  modifiers: OrderItemModifier[];
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

// ========================================
// MENU MANAGEMENT
// ========================================

export interface MenuCategoryRow {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItemRow {
  id: string;
  venue_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
  preparation_time: number | null;
  tags: string[];
  allergens: string[];
  dietary: string[];
  calories: number | null;
  spice_level: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItemModifierRow {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuDesignRow {
  id: string;
  venue_id: string;
  theme: "modern" | "classic" | "minimal" | "colorful";
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_url: string | null;
  logo_size: number;
  show_prices: boolean;
  show_descriptions: boolean;
  show_images: boolean;
  created_at: string;
  updated_at: string;
}

// ========================================
// STAFF & INVITATIONS
// ========================================

export interface StaffInvitationRow {
  id: string;
  venue_id: string;
  email: string;
  role: "manager" | "staff" | "server" | "kitchen";
  permissions: Record<string, boolean>;
  token: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  invited_by: string;
  invited_by_email: string | null;
  invited_by_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ========================================
// INVENTORY
// ========================================

export interface IngredientRow {
  id: string;
  venue_id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  cost_per_unit: number;
  supplier: string | null;
  last_ordered: string | null;
  notes: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryLogRow {
  id: string;
  venue_id: string;
  ingredient_id: string;
  action: "add" | "remove" | "adjust" | "order";
  quantity_change: number;
  quantity_after: number;
  reason: string | null;
  performed_by: string;
  created_at: string;
}

// ========================================
// KDS (Kitchen Display System)
// ========================================

export interface KDSStationRow {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  station_type: "kitchen" | "bar" | "grill" | "prep" | "expo";
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KDSTicketRow {
  id: string;
  venue_id: string;
  order_id: string;
  station_id: string;
  ticket_number: string;
  status: "pending" | "in_progress" | "ready" | "completed" | "cancelled";
  items: KDSTicketItem[];
  priority: "low" | "normal" | "high" | "urgent";
  started_at: string | null;
  completed_at: string | null;
  estimated_completion: string | null;
  created_at: string;
  updated_at: string;
}

export interface KDSTicketItem {
  id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  status: "pending" | "in_progress" | "completed";
  special_instructions: string | null;
  modifiers: OrderItemModifier[];
}

// ========================================
// PAYMENTS
// ========================================

export interface PaymentRow {
  id: string;
  venue_id: string;
  order_id: string;
  amount: number;
  payment_method: "card" | "cash" | "bank_transfer" | "other";
  payment_status: "pending" | "completed" | "failed" | "refunded";
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillSplitRow {
  id: string;
  venue_id: string;
  table_session_id: string | null;
  counter_session_id: string | null;
  split_type: "equal" | "by_item" | "by_person" | "custom";
  splits: BillSplitDetail[];
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface BillSplitDetail {
  id: string;
  person_name: string | null;
  amount: number;
  payment_status: "pending" | "paid";
  payment_method: string | null;
  items: string[];
}

// ========================================
// FEEDBACK
// ========================================

export interface FeedbackRow {
  id: string;
  venue_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  category: "food" | "service" | "ambiance" | "value" | "overall";
  customer_name: string | null;
  customer_email: string | null;
  is_public: boolean;
  response: string | null;
  responded_at: string | null;
  responded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackQuestionRow {
  id: string;
  venue_id: string;
  question_text?: string; // Database column name (snake_case)
  question?: string; // Legacy/alternative column name
  question_type: "rating" | "text" | "multiple_choice" | "yes_no" | "stars" | "paragraph";
  options?: string[];
  is_required?: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ========================================
// ANALYTICS
// ========================================

export interface AnalyticsEventRow {
  id: string;
  venue_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
}

// ========================================
// AI ASSISTANT
// ========================================

export interface AIChatConversationRow {
  id: string;
  venue_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface AIChatMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_name: string | null;
  tool_params: Record<string, unknown> | null;
  execution_result: Record<string, unknown> | null;
  audit_id: string | null;
  created_at: string;
  can_undo: boolean;
  undo_data: Record<string, unknown> | null;
}

export interface AIActionAuditRow {
  id: string;
  venue_id: string;
  user_id: string;
  user_prompt: string;
  intent: string;
  tool_name: string;
  params: Record<string, unknown>;
  preview: boolean;
  executed: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
  context_hash: string | null;
  model_version: string | null;
  execution_time_ms: number | null;
  created_at: string;
  executed_at: string | null;
}

// ========================================
// TYPE HELPERS
// ========================================

export type Role = "owner" | "manager" | "staff" | "server" | "kitchen";
export type OrderStatus = "pending" | "in_prep" | "ready" | "served" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "partial";
export type TableStatus = "available" | "occupied" | "reserved" | "inactive";
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

// ========================================
// JOINED/EXTENDED TYPES
// ========================================

export interface OrderWithTable extends OrderRow {
  tables: Pick<TableRow, "label"> | null;
}

export interface OrderWithItems extends OrderRow {
  order_items: MenuItemRow[];
}

export interface TableWithSession extends TableRow {
  session: TableSessionRow | null;
  orders: OrderRow[];
}

export interface ReservationWithTable extends ReservationRow {
  tables: Pick<TableRow, "label"> | null;
}

// ========================================
// API RESPONSE TYPES
// ========================================

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  ok: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ========================================
// DATABASE HELPER TYPES
// ========================================

export type InsertRow<T> = Omit<T, "id" | "created_at" | "updated_at">;
export type UpdateRow<T> = Partial<Omit<T, "id" | "created_at">>;

// ========================================
// SUPABASE DATABASE TYPE
// ========================================

/**
 * Main Database type for Supabase client
 * This matches the structure expected by Supabase's generated types
 */
export interface Database {
  public: {
    Tables: {
      venues: {
        Row: VenueRow;
        Insert: InsertRow<VenueRow>;
        Update: UpdateRow<VenueRow>;
      };
      user_venue_roles: {
        Row: UserVenueRoleRow;
        Insert: InsertRow<UserVenueRoleRow>;
        Update: UpdateRow<UserVenueRoleRow>;
      };
      tables: {
        Row: TableRow;
        Insert: InsertRow<TableRow>;
        Update: UpdateRow<TableRow>;
      };
      table_sessions: {
        Row: TableSessionRow;
        Insert: InsertRow<TableSessionRow>;
        Update: UpdateRow<TableSessionRow>;
      };
      counter_sessions: {
        Row: CounterSessionRow;
        Insert: InsertRow<CounterSessionRow>;
        Update: UpdateRow<CounterSessionRow>;
      };
      reservations: {
        Row: ReservationRow;
        Insert: InsertRow<ReservationRow>;
        Update: UpdateRow<ReservationRow>;
      };
      orders: {
        Row: OrderRow;
        Insert: InsertRow<OrderRow>;
        Update: UpdateRow<OrderRow>;
      };
      menu_categories: {
        Row: MenuCategoryRow;
        Insert: InsertRow<MenuCategoryRow>;
        Update: UpdateRow<MenuCategoryRow>;
      };
      menu_items: {
        Row: MenuItemRow;
        Insert: InsertRow<MenuItemRow>;
        Update: UpdateRow<MenuItemRow>;
      };
      menu_item_modifiers: {
        Row: MenuItemModifierRow;
        Insert: InsertRow<MenuItemModifierRow>;
        Update: UpdateRow<MenuItemModifierRow>;
      };
      menu_design: {
        Row: MenuDesignRow;
        Insert: InsertRow<MenuDesignRow>;
        Update: UpdateRow<MenuDesignRow>;
      };
      staff_invitations: {
        Row: StaffInvitationRow;
        Insert: InsertRow<StaffInvitationRow>;
        Update: UpdateRow<StaffInvitationRow>;
      };
      ingredients: {
        Row: IngredientRow;
        Insert: InsertRow<IngredientRow>;
        Update: UpdateRow<IngredientRow>;
      };
      inventory_logs: {
        Row: InventoryLogRow;
        Insert: InsertRow<InventoryLogRow>;
        Update: UpdateRow<InventoryLogRow>;
      };
      kds_stations: {
        Row: KDSStationRow;
        Insert: InsertRow<KDSStationRow>;
        Update: UpdateRow<KDSStationRow>;
      };
      kds_tickets: {
        Row: KDSTicketRow;
        Insert: InsertRow<KDSTicketRow>;
        Update: UpdateRow<KDSTicketRow>;
      };
      payments: {
        Row: PaymentRow;
        Insert: InsertRow<PaymentRow>;
        Update: UpdateRow<PaymentRow>;
      };
      bill_splits: {
        Row: BillSplitRow;
        Insert: InsertRow<BillSplitRow>;
        Update: UpdateRow<BillSplitRow>;
      };
      feedback: {
        Row: FeedbackRow;
        Insert: InsertRow<FeedbackRow>;
        Update: UpdateRow<FeedbackRow>;
      };
      feedback_questions: {
        Row: FeedbackQuestionRow;
        Insert: InsertRow<FeedbackQuestionRow>;
        Update: UpdateRow<FeedbackQuestionRow>;
      };
      analytics_events: {
        Row: AnalyticsEventRow;
        Insert: InsertRow<AnalyticsEventRow>;
        Update: Partial<AnalyticsEventRow>;
      };
      ai_chat_conversations: {
        Row: AIChatConversationRow;
        Insert: InsertRow<AIChatConversationRow>;
        Update: UpdateRow<AIChatConversationRow>;
      };
      ai_chat_messages: {
        Row: AIChatMessageRow;
        Insert: InsertRow<AIChatMessageRow>;
        Update: UpdateRow<AIChatMessageRow>;
      };
      ai_action_audit: {
        Row: AIActionAuditRow;
        Insert: InsertRow<AIActionAuditRow>;
        Update: UpdateRow<AIActionAuditRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
