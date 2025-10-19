/**
 * Type-Safe Orders API Route Example
 * This demonstrates how to use the type-safe route helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createGetHandler, createPostHandler, successResponse, errorResponse } from '@/lib/api/route-helpers';
import { CreateOrderSchema, OrderResponse, CreateOrderRequest } from '@/types/api';
import { createSupabaseClient } from '@/lib/supabase/unified-client';
import { withAuthorization } from '@/lib/middleware/authorization';

// ============================================================================
// GET /api/orders - Get all orders
// ============================================================================

export const GET = createGetHandler<OrderResponse[]>(async (req) => {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  
  if (!venueId) {
    throw new Error('venueId is required');
  }
  
  const supabase = await createSupabaseClient('server');
  
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw error;
  }
  
  return data || [];
});

// ============================================================================
// POST /api/orders - Create new order
// ============================================================================

export const POST = createPostHandler<CreateOrderRequest, OrderResponse>(
  async (req, body) => {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      throw new Error('venueId is required');
    }
    
    const supabase = await createSupabaseClient('server');
    
    const { data, error } = await supabase
      .from('orders')
      .insert({
        ...body,
        venue_id: venueId,
        order_status: 'PLACED',
        payment_status: 'UNPAID',
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  },
  CreateOrderSchema
);

// ============================================================================
// Alternative: Using withAuthorization middleware
// ============================================================================

export const GET_SECURE = withAuthorization(async (req, context) => {
  const supabase = await createSupabaseClient('server');
  
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('venue_id', context.venueId)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw error;
  }
  
  return successResponse(data || []);
});

export const POST_SECURE = withAuthorization(async (req, context) => {
  const body = await req.json();
  
  // Validate body
  const validation = CreateOrderSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid request data',
        message: validation.error.errors.map(e => e.message).join(', '),
      },
      { status: 400 }
    );
  }
  
  const supabase = await createSupabaseClient('server');
  
  const { data, error } = await supabase
    .from('orders')
    .insert({
      ...validation.data,
      venue_id: context.venueId,
      order_status: 'PLACED',
      payment_status: 'UNPAID',
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return successResponse(data);
});

