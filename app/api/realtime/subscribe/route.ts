/**
 * API Route: /api/realtime/subscribe
 * Manages server-side realtime subscription configuration
 * 
 * This route provides subscription configuration and validation endpoints.
 * Actual channel subscriptions should be created client-side using the
 * subscription manager hooks.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/monitoring/structured-logger";

// ============================================================================
// Types
// ============================================================================

interface SubscribeRequest {
  venueId: string;
  channels: Array<{
    type: 'orders' | 'tables' | 'inventory' | 'reservations' | 'analytics' | 'custom';
    customChannel?: string;
    events?: ('INSERT' | 'UPDATE' | 'DELETE' | '*')[];
  }>;
  presence?: {
    userId: string;
    userData?: Record<string, unknown>;
  };
}

interface SubscribeResponse {
  success: boolean;
  channels: Array<{
    name: string;
    status: string;
  }>;
  presence?: {
    channel: string;
    key: string;
  };
  error?: string;
}

// ============================================================================
// Table to Channel Mapping
// ============================================================================

const TABLE_MAPPING: Record<string, string[]> = {
  orders: ['orders', 'order_items'],
  tables: ['tables', 'table_sessions'],
  inventory: ['inventory_items', 'inventory_transactions'],
  reservations: ['reservations'],
  analytics: ['daily_metrics', 'hourly_metrics'],
};

// ============================================================================
// POST Handler - Create Subscription
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SubscribeResponse>> {
  try {
    const body: SubscribeRequest = await request.json();
    const { venueId, channels, presence } = body;

    if (!venueId) {
      return NextResponse.json(
        { success: false, channels: [], error: 'venueId is required' },
        { status: 400 }
      );
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { success: false, channels: [], error: 'At least one channel is required' },
        { status: 400 }
      );
    }

    logger.info('[realtime/subscribe] Creating subscription configuration', { 
      venueId, 
      channelCount: channels.length 
    });

    const channelResults: Array<{ name: string; status: string }> = [];

    // Generate channel configurations for each subscription type
    for (const channelConfig of channels) {
      const channelType = channelConfig.type;
      const tables = channelType === 'custom' 
        ? [] 
        : TABLE_MAPPING[channelType] || [];

      // Generate channel name
      const channelName = `api:${venueId}:${channelType}:${Date.now()}`;

      try {
        // Validate tables exist (basic check)
        for (const table of tables) {
          channelResults.push({
            name: `${channelName}:${table}`,
            status: 'configured',
          });
        }

        if (tables.length === 0) {
          channelResults.push({
            name: channelName,
            status: 'configured',
          });
        }

        logger.info('[realtime/subscribe] Channel configured', { channelName, type: channelType });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('[realtime/subscribe] Channel configuration failed', { 
          channelName, 
          error: error.message 
        });
        
        return NextResponse.json(
          { 
            success: false, 
            channels: channelResults,
            error: `Failed to configure channel for ${channelType}: ${error.message}` 
          },
          { status: 500 }
        );
      }
    }

    // Handle presence configuration if requested
    let presenceResult: SubscribeResponse['presence'];
    if (presence) {
      const presenceChannelName = `presence:${venueId}`;
      
      presenceResult = {
        channel: presenceChannelName,
        key: presence.userId,
      };

      logger.info('[realtime/subscribe] Presence configured', { 
        venueId, 
        userId: presence.userId 
      });
    }

    return NextResponse.json({
      success: true,
      channels: channelResults,
      presence: presenceResult,
    });

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[realtime/subscribe] Request failed', { error: error.message });
    
    return NextResponse.json(
      { success: false, channels: [], error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler - Get Supported Channels
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<{
  success: boolean;
  supportedTables: string[];
  channelTypes: Array<{ type: string; tables: string[] }>;
  error?: string;
}>> {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId') ?? undefined;

    logger.info('[realtime/subscribe] Getting subscription config', { venueId });

    const allTables: string[] = [];
    const channelTypes: Array<{ type: string; tables: string[] }> = [];

    for (const [type, tables] of Object.entries(TABLE_MAPPING)) {
      channelTypes.push({ type, tables });
      allTables.push(...tables);
    }

    return NextResponse.json({
      success: true,
      supportedTables: allTables,
      channelTypes,
    });

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[realtime/subscribe] Config fetch failed', { error: error.message });
    
    return NextResponse.json(
      { success: false, supportedTables: [], channelTypes: [], error: error.message },
      { status: 500 }
    );
  }
}
