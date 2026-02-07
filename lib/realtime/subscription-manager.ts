/**
 * Subscription Manager
 * Core subscription management for Supabase Realtime
 * 
 * Features:
 * - Generic subscription manager class
 * - Automatic reconnection handling
 * - Event deduplication
 * - Subscription cleanup on unmount
 */

import { supabaseBrowser } from "@/lib/supabase";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { logger } from "@/lib/monitoring/structured-logger";

// ============================================================================
// Configuration Constants
// ============================================================================

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const DEDUP_WINDOW_MS = 100;

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'error'
  | 'closed';

export type PostgresEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type SubscriptionStatus = 
  | 'SUBSCRIBED' 
  | 'TIMED_OUT' 
  | 'CLOSED' 
  | 'CHANNEL_ERROR';

export interface PostgresPayload<T = Record<string, unknown>> {
  eventType: PostgresEventType;
  new: T | null;
  old: T | null;
}

export interface SubscriptionFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in';
  value: string | number | boolean | (string | number)[];
}

export interface PostgresSubscriptionConfig {
  schema: string;
  table: string;
  event?: PostgresEventType;
  filters?: SubscriptionFilter[];
}

export interface SubscriptionConfig {
  channelName: string;
  postgres?: PostgresSubscriptionConfig[];
}

export interface CreateSubscriptionOptions {
  channelName: string;
  config: SubscriptionConfig;
  onStatusChange?: (status: SubscriptionStatus) => void;
  onEvent?: (payload: unknown) => void;
}

export interface SubscriptionEntry {
  id: string;
  channel: RealtimeChannel;
  config: SubscriptionConfig;
  status: SubscriptionStatus;
  refCount: number;
  createdAt: number;
}

// ============================================================================
// Deduplication Utilities
// ============================================================================

interface DedupEntry {
  timestamp: number;
  payload: string;
}

class DedupCache {
  private cache: Map<string, DedupEntry> = new Map();
  private maxSize = 1000;
  private windowMs = DEDUP_WINDOW_MS;

  shouldProcess(key: string, payload: unknown): boolean {
    const now = Date.now();
    const payloadStr = JSON.stringify(payload);
    const existing = this.cache.get(key);

    if (existing && now - existing.timestamp < this.windowMs && existing.payload === payloadStr) {
      return false;
    }

    this.cache.set(key, { timestamp: now, payload: payloadStr });

    if (this.cache.size > this.maxSize) {
      this.cleanup(now - this.windowMs);
    }

    return true;
  }

  private cleanup(olderThan: number): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < olderThan) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Subscription Manager Class
// ============================================================================

export class SubscriptionManager {
  private static instance: SubscriptionManager | null = null;
  private supabase = supabaseBrowser();
  private subscriptions: Map<string, SubscriptionEntry> = new Map();
  private dedupCache = new DedupCache();
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: Map<string, number> = new Map();
  private listeners: Map<string, Set<(status: SubscriptionStatus) => void>> = new Map();
  private eventHandlers: Map<string, Set<(payload: unknown) => void>> = new Map();

  private constructor() {
    this.initializeConnection();
  }

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  static resetInstance(): void {
    if (SubscriptionManager.instance) {
      SubscriptionManager.instance.unsubscribeAll();
      SubscriptionManager.instance = null;
    }
  }

  // --------------------------------------------------------------------------
  // Connection Management
  // --------------------------------------------------------------------------

  private initializeConnection(): void {
    this.updateConnectionState('connecting');

    if (typeof window !== "undefined") {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  private handleOnline(): void {
    logger.info('[SubscriptionManager] Browser came online, reconnecting...');
    this.updateConnectionState('connecting');
    this.reconnectAll();
  }

  private handleOffline(): void {
    logger.warn('[SubscriptionManager] Browser went offline');
    this.updateConnectionState('disconnected');
  }

  private updateConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // --------------------------------------------------------------------------
  // Subscription Creation
  // --------------------------------------------------------------------------

  async createSubscription(options: CreateSubscriptionOptions): Promise<SubscriptionEntry> {
    const { channelName, config, onStatusChange, onEvent } = options;

    const existingEntry = this.subscriptions.get(channelName);
    if (existingEntry) {
      existingEntry.refCount++;
      if (onStatusChange) {
        this.addStatusListener(channelName, onStatusChange);
      }
      return existingEntry;
    }

    const channel = this.supabase.channel(channelName);

    if (onStatusChange) {
      this.addStatusListener(channelName, onStatusChange);
    }

    if (config.postgres && config.postgres.length > 0) {
      this.configurePostgresChanges(channel, config.postgres, onEvent);
    }

    channel.subscribe((status: SubscriptionStatus) => {
      this.handleSubscriptionStatus(channelName, status);
      if (status === 'CHANNEL_ERROR') {
        this.attemptReconnect(channelName);
      }
    });

    const entry: SubscriptionEntry = {
      id: channelName,
      channel,
      config,
      status: 'CLOSED',
      refCount: 1,
      createdAt: Date.now(),
    };

    this.subscriptions.set(channelName, entry);
    return entry;
  }

  private configurePostgresChanges(
    channel: RealtimeChannel,
    configs: PostgresSubscriptionConfig[],
    onEvent?: (payload: unknown) => void
  ): void {
    for (const pgConfig of configs) {
      const filterParts: string[] = [];
      if (pgConfig.filters && pgConfig.filters.length > 0) {
        for (const filter of pgConfig.filters) {
          const op = this.operatorToSymbol(filter.operator);
          const value = Array.isArray(filter.value) 
            ? `(${filter.value.join(',')})` 
            : filter.value;
          filterParts.push(`${filter.column}${op}${value}`);
        }
      }
      const filterString = filterParts.length > 0 ? filterParts.join(',') : undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).on(
        "postgres_changes",
        {
          event: pgConfig.event || '*',
          schema: pgConfig.schema,
          table: pgConfig.table,
          filter: filterString,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const payloadRecord = payload.new as Record<string, unknown> | null || payload.old as Record<string, unknown> | null || {};
          const dedupKey = `${pgConfig.table}:${payload.eventType}:${payloadRecord['id'] || Date.now()}`;
          if (this.dedupCache.shouldProcess(dedupKey, payload)) {
            const transformedPayload: PostgresPayload = {
              eventType: payload.eventType as PostgresEventType,
              new: payload.new as Record<string, unknown> | null,
              old: payload.old as Record<string, unknown> | null,
            };
            this.broadcastEvent(pgConfig.table, transformedPayload);
            if (onEvent) {
              onEvent(transformedPayload);
            }
          }
        }
      );
    }
  }

  private operatorToSymbol(operator: SubscriptionFilter['operator']): string {
    const symbols: Record<string, string> = {
      eq: '=',
      neq: '!=',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      like: '.like.',
      ilike: '.ilike.',
      in: '.in.',
    };
    return symbols[operator] || '=';
  }

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  private handleSubscriptionStatus(channelName: string, status: SubscriptionStatus): void {
    const entry = this.subscriptions.get(channelName);
    if (entry) {
      entry.status = status;
    }

    if (status === 'SUBSCRIBED') {
      this.reconnectAttempts.set(channelName, 0);
      if (this.connectionState !== 'connected') {
        this.updateConnectionState('connected');
      }
    }

    if (status === 'CHANNEL_ERROR') {
      this.updateConnectionState('error');
    }

    this.broadcastStatusChange(channelName, status);
  }

  // --------------------------------------------------------------------------
  // Reconnection Logic
  // --------------------------------------------------------------------------

  private async attemptReconnect(channelName: string): Promise<void> {
    const currentAttempts = this.reconnectAttempts.get(channelName) || 0;
    
    if (currentAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn(`[SubscriptionManager] Max reconnect attempts reached for ${channelName}`);
      return;
    }

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, currentAttempts),
      MAX_RECONNECT_DELAY_MS
    );

    this.reconnectAttempts.set(channelName, currentAttempts + 1);
    logger.info(`[SubscriptionManager] Attempting reconnect ${currentAttempts + 1} for ${channelName} in ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    const entry = this.subscriptions.get(channelName);
    if (entry) {
      this.supabase.removeChannel(entry.channel);
    }

    await this.createSubscription({
      channelName,
      config: entry?.config || { channelName },
    });
  }

  private async reconnectAll(): Promise<void> {
    const channelNames = Array.from(this.subscriptions.keys());
    
    for (const channelName of channelNames) {
      await this.attemptReconnect(channelName);
    }
  }

  // --------------------------------------------------------------------------
  // Event Broadcasting
  // --------------------------------------------------------------------------

  private broadcastEvent(eventType: string, payload: unknown): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          logger.error(`[SubscriptionManager] Error in event handler for ${eventType}`, { error: err });
        }
      }
    }
  }

  private broadcastStatusChange(channelName: string, status: SubscriptionStatus): void {
    const listeners = this.listeners.get(channelName);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(status);
        } catch (err) {
          logger.error(`[SubscriptionManager] Error in status listener for ${channelName}`, { error: err });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Listener Management
  // --------------------------------------------------------------------------

  private addStatusListener(channelName: string, callback: (status: SubscriptionStatus) => void): void {
    if (!this.listeners.has(channelName)) {
      this.listeners.set(channelName, new Set());
    }
    this.listeners.get(channelName)!.add(callback);
  }

  removeStatusListener(channelName: string, callback: (status: SubscriptionStatus) => void): void {
    const listeners = this.listeners.get(channelName);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(channelName);
      }
    }
  }

  addEventHandler(eventType: string, callback: (payload: unknown) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(callback);
  }

  removeEventHandler(eventType: string, callback: (payload: unknown) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Subscription Management
  // --------------------------------------------------------------------------

  async removeSubscription(channelName: string): Promise<void> {
    const entry = this.subscriptions.get(channelName);
    if (!entry) {
      return;
    }

    entry.refCount--;
    
    if (entry.refCount <= 0) {
      this.supabase.removeChannel(entry.channel);
      this.subscriptions.delete(channelName);
      this.listeners.delete(channelName);
      this.reconnectAttempts.delete(channelName);
    }
  }

  async unsubscribeAll(): Promise<void> {
    for (const [channelName, entry] of this.subscriptions.entries()) {
      this.supabase.removeChannel(entry.channel);
    }
    this.subscriptions.clear();
    this.listeners.clear();
    this.eventHandlers.clear();
    this.reconnectAttempts.clear();
    this.dedupCache.clear();
    this.updateConnectionState('disconnected');
  }

  getSubscriptions(): SubscriptionEntry[] {
    return Array.from(this.subscriptions.values());
  }

  getSubscription(channelName: string): SubscriptionEntry | undefined {
    return this.subscriptions.get(channelName);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  static generateChannelName(venueId: string, entityType: string, entityId?: string): string {
    const parts = ['realtime', venueId, entityType];
    if (entityId) {
      parts.push(entityId);
    }
    return parts.join(':');
  }

  static createPostgresConfig(
    table: string,
    event?: PostgresEventType,
    filters?: SubscriptionFilter[]
  ): PostgresSubscriptionConfig[] {
    return [{
      schema: 'public',
      table,
      event,
      filters,
    }];
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const subscriptionManager = SubscriptionManager.getInstance();
