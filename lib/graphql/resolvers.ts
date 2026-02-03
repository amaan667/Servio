/**
 * @fileoverview GraphQL Resolvers
 * Provides resolvers for GraphQL queries and mutations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * GraphQL Context
 */
export interface GraphQLContext {
  supabase: SupabaseClient;
  userId?: string;
  venueId?: string;
}

/**
 * Create GraphQL context
 */
export async function createContext(req: Request): Promise<GraphQLContext> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get user from authorization header
  const authHeader = req.headers.get('authorization');
  let userId: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id;
  }

  return { supabase, userId };
}

/**
 * Query Resolvers
 */
export const queryResolvers = {
  // Venue queries
  venue: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  venues: async (_: unknown, { first = 10, after }: { first?: number; after?: string }, context: GraphQLContext) => {
    let query = context.supabase
      .from('venues')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(first);

    if (after) {
      query = query.gt('created_at', after);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      edges: (data || []).map(venue => ({
        node: venue,
        cursor: venue.created_at,
      })),
      pageInfo: {
        hasNextPage: (data?.length || 0) >= first,
        hasPreviousPage: !!after,
        startCursor: data?.[0]?.created_at,
        endCursor: data?.[data.length - 1]?.created_at,
      },
    };
  },

  searchVenues: async (_: unknown, { query, first = 10 }: { query: string; first?: number }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('venues')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(first);

    if (error) throw error;
    return data || [];
  },

  // Menu queries
  menuItem: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('menu_items')
      .select('*, menu_categories(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  menuItems: async (_: unknown, { venueId, categoryId, first = 10, after }: { venueId: string; categoryId?: string; first?: number; after?: string }, context: GraphQLContext) => {
    let query = context.supabase
      .from('menu_items')
      .select('*, menu_categories(*)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(first);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (after) {
      query = query.gt('created_at', after);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      edges: (data || []).map(item => ({
        node: item,
        cursor: item.created_at,
      })),
      pageInfo: {
        hasNextPage: (data?.length || 0) >= first,
        hasPreviousPage: !!after,
        startCursor: data?.[0]?.created_at,
        endCursor: data?.[data.length - 1]?.created_at,
      },
    };
  },

  menuCategories: async (_: unknown, { venueId }: { venueId: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('menu_categories')
      .select('*')
      .eq('venue_id', venueId)
      .order('order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Order queries
  order: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  orders: async (_: unknown, { venueId, status, first = 10, after }: { venueId: string; status?: string; first?: number; after?: string }, context: GraphQLContext) => {
    let query = context.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(first);

    if (status) {
      query = query.eq('status', status);
    }

    if (after) {
      query = query.gt('created_at', after);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      edges: (data || []).map(order => ({
        node: order,
        cursor: order.created_at,
      })),
      pageInfo: {
        hasNextPage: (data?.length || 0) >= first,
        hasPreviousPage: !!after,
        startCursor: data?.[0]?.created_at,
        endCursor: data?.[data.length - 1]?.created_at,
      },
    };
  },

  liveOrders: async (_: unknown, { venueId }: { venueId: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('venue_id', venueId)
      .in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'])
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Table queries
  table: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('tables')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  tables: async (_: unknown, { venueId, status }: { venueId: string; status?: string }, context: GraphQLContext) => {
    let query = context.supabase
      .from('tables')
      .select('*')
      .eq('venue_id', venueId)
      .order('name', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Staff queries
  staff: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  staffList: async (_: unknown, { venueId }: { venueId: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('staff')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Inventory queries
  inventoryItem: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  inventoryItems: async (_: unknown, { venueId }: { venueId: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('inventory_items')
      .select('*')
      .eq('venue_id', venueId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  inventoryMovements: async (_: unknown, { venueId, itemId, first = 10 }: { venueId: string; itemId?: string; first?: number }, context: GraphQLContext) => {
    let query = context.supabase
      .from('inventory_movements')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(first);

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      edges: (data || []).map(movement => ({
        node: movement,
        cursor: movement.created_at,
      })),
      pageInfo: {
        hasNextPage: (data?.length || 0) >= first,
        hasPreviousPage: false,
        startCursor: data?.[0]?.created_at,
        endCursor: data?.[data.length - 1]?.created_at,
      },
    };
  },

  // Analytics queries (placeholder implementations)
  venueAnalytics: async (_: unknown, { venueId, period }: { venueId: string; period: string }, _context: GraphQLContext) => {
    // Placeholder - implement actual analytics calculation
    return {
      venueId,
      period,
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      totalCustomers: 0,
      tableTurnoverRate: 0,
      peakHours: [],
    };
  },

  revenueAnalytics: async (_: unknown, { venueId, period }: { venueId: string; period: string }, _context: GraphQLContext) => {
    // Placeholder - implement actual analytics calculation
    return {
      venueId,
      period,
      totalRevenue: 0,
      revenueByCategory: [],
      revenueByPaymentMethod: [],
      revenueTrend: [],
    };
  },

  orderAnalytics: async (_: unknown, { venueId, period }: { venueId: string; period: string }, _context: GraphQLContext) => {
    // Placeholder - implement actual analytics calculation
    return {
      venueId,
      period,
      totalOrders: 0,
      ordersByStatus: [],
      ordersByHour: [],
      averagePreparationTime: 0,
      averageServiceTime: 0,
    };
  },
};

/**
 * Mutation Resolvers
 */
export const mutationResolvers = {
  // Venue mutations
  createVenue: async (_: unknown, { input }: { input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('venues')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateVenue: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('venues')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteVenue: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { error } = await context.supabase
      .from('venues')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Menu mutations
  createMenuItem: async (_: unknown, { input }: { input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('menu_items')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateMenuItem: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('menu_items')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteMenuItem: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const { error } = await context.supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Order mutations
  createOrder: async (_: unknown, { input }: { input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('orders')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateOrder: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('orders')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateOrderStatus: async (_: unknown, { id, status }: { id: string; status: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Table mutations
  createTable: async (_: unknown, { input }: { input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('tables')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateTable: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('tables')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  seatTable: async (_: unknown, { tableId, sessionId }: { tableId: string; sessionId: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('tables')
      .update({ status: 'OCCUPIED', current_session: sessionId })
      .eq('id', tableId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  clearTable: async (_: unknown, { tableId }: { tableId: string }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('tables')
      .update({ status: 'AVAILABLE', current_session: null, current_order_id: null })
      .eq('id', tableId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Staff mutations
  createStaff: async (_: unknown, { input }: { input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('staff')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateStaff: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('staff')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Inventory mutations
  createInventoryItem: async (_: unknown, { input }: { input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('inventory_items')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateInventoryItem: async (_: unknown, { id, input }: { id: string; input: Record<string, unknown> }, context: GraphQLContext) => {
    const { data, error } = await context.supabase
      .from('inventory_items')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  adjustStock: async (_: unknown, { itemId, quantity, reason }: { itemId: string; quantity: number; reason: string }, context: GraphQLContext) => {
    // Get current item
    const { data: item } = await context.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (!item) throw new Error('Item not found');

    // Create movement record
    const { data: movement, error: movementError } = await context.supabase
      .from('inventory_movements')
      .insert({
        item_id: itemId,
        venue_id: item.venue_id,
        type: 'ADJUSTMENT',
        quantity,
        reason,
      })
      .select()
      .single();

    if (movementError) throw movementError;

    // Update item quantity
    const { data: updatedItem, error: updateError } = await context.supabase
      .from('inventory_items')
      .update({ quantity: item.quantity + quantity })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) throw updateError;

    return movement;
  },
};

/**
 * Subscription Resolvers
 */
export const subscriptionResolvers = {
  orderUpdated: {
    subscribe: (_: unknown, { venueId: _venueId }: { venueId: string }, _context: GraphQLContext) => {
      // Placeholder - implement actual subscription using Supabase realtime
      return {
        async *[Symbol.asyncIterator]() {
          // Yield updates as they come in
          while (true) {
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
            // In production, this would use Supabase realtime subscriptions
            yield undefined;
          }
        },
      };
    },
  },

  tableUpdated: {
    subscribe: (_: unknown, { venueId: _venueId }: { venueId: string }, _context: GraphQLContext) => {
      // Placeholder - implement actual subscription using Supabase realtime
      return {
        async *[Symbol.asyncIterator]() {
          while (true) {
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
            yield undefined;
          }
        },
      };
    },
  },

  inventoryUpdated: {
    subscribe: (_: unknown, { venueId: _venueId }: { venueId: string }, _context: GraphQLContext) => {
      // Placeholder - implement actual subscription using Supabase realtime
      return {
        async *[Symbol.asyncIterator]() {
          while (true) {
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
            yield undefined;
          }
        },
      };
    },
  },

  liveOrders: {
    subscribe: (_: unknown, { venueId: _venueId }: { venueId: string }, _context: GraphQLContext) => {
      // Placeholder - implement actual subscription using Supabase realtime
      return {
        async *[Symbol.asyncIterator]() {
          while (true) {
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
            yield undefined;
          }
        },
      };
    },
  },
};

/**
 * Combined resolvers
 */
export const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  Subscription: subscriptionResolvers,
};
