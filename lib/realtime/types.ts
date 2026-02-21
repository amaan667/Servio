/**
 * Realtime Subscription Types
 * TypeScript types for Supabase Realtime subscriptions
 */

import { RealtimeChannel } from "@supabase/supabase-js";

// ============================================================================
// Base Types
// ============================================================================

/** Connection state for realtime subscriptions */
export type ConnectionState = "connecting" | "connected" | "disconnected" | "error" | "closed";

/** Event types for postgres changes */
export type PostgresEventType = "INSERT" | "UPDATE" | "DELETE" | "*";

/** Channel event types */
export type ChannelEventType = "postgres_changes" | "broadcast" | "presence";

/** Subscription status */
export type SubscriptionStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | "ERROR";

// ============================================================================
// Payload Types
// ============================================================================

/** Generic payload from postgres changes */
export interface PostgresPayload<T = Record<string, unknown>> {
  readonly eventType: PostgresEventType;
  readonly new: T | null;
  readonly old: T | null;
  readonly commit?: {
    readonly timestamp: string;
  };
}

/** Broadcast message payload */
export interface BroadcastPayload<T = unknown> {
  readonly sender: string;
  readonly message: T;
  readonly timestamp: number;
}

/** Presence state payload */
export interface PresenceState {
  readonly [key: string]: PresenceUser[];
}

/** Presence user data */
export interface PresenceUser {
  readonly userId: string;
  readonly name?: string;
  readonly email?: string;
  readonly metadata?: Record<string, unknown>;
  readonly onlineAt?: string;
}

// ============================================================================
// Subscription Configuration Types
// ============================================================================

/** Filter configuration for postgres changes */
export interface SubscriptionFilter {
  column: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in";
  value: string | number | boolean | (string | number)[];
}

/** Configuration for a single postgres changes subscription */
export interface PostgresSubscriptionConfig {
  schema: string;
  table: string;
  event?: PostgresEventType;
  filters?: SubscriptionFilter[];
}

/** Configuration for broadcast subscription */
export interface BroadcastSubscriptionConfig {
  event: string;
  filter?: {
    sender?: string;
  };
}

/** Configuration for presence subscription */
export interface PresenceSubscriptionConfig {
  key?: string;
}

/** Complete subscription configuration */
export interface SubscriptionConfig {
  channelName: string;
  postgres?: PostgresSubscriptionConfig[];
  broadcast?: BroadcastSubscriptionConfig[];
  presence?: PresenceSubscriptionConfig;
}

// ============================================================================
// Callback Types
// ============================================================================

/** Callback for postgres changes */
export type PostgresChangeCallback<T = Record<string, unknown>> = (
  payload: PostgresPayload<T>
) => void;

/** Callback for broadcast messages */
export type BroadcastCallback<T = unknown> = (payload: BroadcastPayload<T>) => void;

/** Callback for presence sync */
export type PresenceCallback = (state: PresenceState) => void;

/** Callback for presence join */
export type PresenceJoinCallback = (key: string, newPresences: PresenceUser[]) => void;

/** Callback for presence leave */
export type PresenceLeaveCallback = (key: string, leftPresences: PresenceUser[]) => void;

/** Callback for subscription status changes */
export type SubscriptionStatusCallback = (status: SubscriptionStatus, error?: Error) => void;

/** Unified callback that handles all event types */
export type RealtimeCallback<T = unknown> =
  | PostgresChangeCallback<T>
  | BroadcastCallback<T>
  | PresenceCallback
  | PresenceJoinCallback
  | PresenceLeaveCallback;

// ============================================================================
// Hook Return Types
// ============================================================================

/** Return type for realtime hooks */
export interface UseRealtimeReturn<T> {
  /** Current data */
  data: T | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error message */
  error: Error | null;
  /** Connection status */
  connectionState: ConnectionState;
  /** Subscribe to changes */
  subscribe: () => void;
  /** Unsubscribe from changes */
  unsubscribe: () => void;
  /** Refresh data */
  refresh: () => Promise<void>;
}

// ============================================================================
// Order Types
// ============================================================================

export interface RealtimeOrder {
  id: string;
  venue_id: string;
  table_number: number | null;
  table_id: string | null;
  table_label?: string | null;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  payment_status?: string;
  payment_method?: string;
  total_amount: number;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
  created_at: string;
  updated_at: string;
  source?: string;
}

// ============================================================================
// Table Types
// ============================================================================

export interface RealtimeTable {
  id: string;
  venue_id: string;
  table_number: number;
  label: string;
  section?: string | null;
  seat_count: number;
  status: string;
  is_active: boolean;
  qr_code_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RealtimeTableSession {
  id: string;
  venue_id: string;
  table_id: string;
  status: string;
  opened_at: string;
  closed_at?: string | null;
  order_id?: string | null;
}

// ============================================================================
// Inventory Types
// ============================================================================

export interface RealtimeInventoryItem {
  id: string;
  venue_id: string;
  name: string;
  sku?: string;
  quantity: number;
  unit?: string;
  min_quantity?: number;
  max_quantity?: number;
  category?: string;
  last_restocked_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Reservation Types
// ============================================================================

export interface RealtimeReservation {
  id: string;
  venue_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  party_size: number;
  reservation_time: string;
  table_id?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface RealtimeAnalyticsUpdate {
  venue_id: string;
  metric_type: "orders" | "revenue" | "items_sold" | "customers";
  value: number;
  previous_value?: number;
  timestamp: string;
}

// ============================================================================
// Event Bus Types
// ============================================================================

/** Event bus message for cross-component communication */
export interface RealtimeEvent {
  id: string;
  type: string;
  venueId?: string;
  timestamp: number;
  payload: unknown;
  source?: string;
}

/** Event bus subscription */
export interface EventBusSubscription {
  id: string;
  eventType: string;
  callback: (event: RealtimeEvent) => void;
  venueId?: string;
}

// ============================================================================
// Manager Types
// ============================================================================

/** Options for creating a subscription */
export interface CreateSubscriptionOptions {
  channelName: string;
  config: SubscriptionConfig;
  onStatusChange?: SubscriptionStatusCallback;
  onError?: (error: Error) => void;
}

/** Subscription entry in the manager */
export interface SubscriptionEntry {
  id: string;
  channel: RealtimeChannel;
  config: SubscriptionConfig;
  status: SubscriptionStatus;
  refCount: number;
  createdAt: number;
}

// ============================================================================
// API Route Types
// ============================================================================

/** Request body for subscription API */
export interface SubscribeRequest {
  venueId: string;
  channels: Array<{
    type: "orders" | "tables" | "inventory" | "reservations" | "analytics" | "custom";
    customChannel?: string;
    events?: PostgresEventType[];
  }>;
  presence?: {
    userId: string;
    userData?: Record<string, unknown>;
  };
}

/** Response from subscription API */
export interface SubscribeResponse {
  success: boolean;
  channels: Array<{
    name: string;
    status: SubscriptionStatus;
  }>;
  presence?: {
    channel: string;
    key: string;
  };
  error?: string;
}

/** Presence tracking request */
export interface PresenceRequest {
  venueId: string;
  userId: string;
  userData?: Record<string, unknown>;
  action: "join" | "leave";
}

/** Presence tracking response */
export interface PresenceResponse {
  success: boolean;
  presenceState?: PresenceState;
  error?: string;
}
