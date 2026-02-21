/**
 * Realtime Module Exports
 */

// Re-export types from types.ts
export type {
  ConnectionState,
  PostgresEventType,
  PostgresPayload,
  SubscriptionStatus,
  SubscriptionFilter,
  SubscriptionConfig,
  PostgresSubscriptionConfig,
  SubscriptionEntry,
  CreateSubscriptionOptions,
  RealtimeOrder,
  RealtimeTable,
  RealtimeInventoryItem,
  RealtimeReservation,
  RealtimeAnalyticsUpdate,
  RealtimeEvent,
  RealtimeCallback,
  UseRealtimeReturn,
  SubscribeRequest,
  SubscribeResponse,
  BroadcastPayload,
  PresenceState,
  PresenceUser,
} from "./types";

// Re-export from subscription-manager
export { SubscriptionManager, subscriptionManager } from "./subscription-manager";
