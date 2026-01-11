/**
 * GraphQL API Endpoint
 * Provides GraphQL API alongside REST API for flexible querying
 */

import { NextRequest, NextResponse } from "next/server";
import { graphql, buildSchema } from "graphql";

import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";

interface CreateOrderInput {
  venueId: string;
  customerName: string;
  customerPhone: string;
  items: OrderItemInput[];
}

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  price: number;
  itemName: string;
}

// GraphQL Schema
const schema = buildSchema(`
  type Query {
    orders(venueId: ID!, limit: Int, offset: Int): [Order!]!
    order(id: ID!): Order
    menu(venueId: ID!): [MenuItem!]!
    venue(id: ID!): Venue
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: String!): Order!
  }

  type Order {
    id: ID!
    venueId: ID!
    totalAmount: Float!
    orderStatus: String!
    paymentStatus: String!
    items: [OrderItem!]!
    createdAt: String!
  }

  type OrderItem {
    id: ID!
    menuItemId: ID
    quantity: Int!
    price: Float!
    itemName: String!
  }

  type MenuItem {
    id: ID!
    venueId: ID!
    name: String!
    description: String
    price: Float!
    category: String!
    isAvailable: Boolean!
  }

  type Venue {
    id: ID!
    name: String!
    businessType: String!
    address: String
  }

  input CreateOrderInput {
    venueId: ID!
    items: [OrderItemInput!]!
    customerName: String
    customerPhone: String
  }

  input OrderItemInput {
    menuItemId: ID
    quantity: Int!
    price: Float!
    itemName: String!
  }
`);

// Resolvers
const rootValue = {
  orders: async ({
    venueId,
    limit = 50,
    offset = 0,
  }: {
    venueId: string;
    limit?: number;
    offset?: number;
  }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (*)
      `
      )
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {

      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    return (
      data?.map((order) => ({
        id: order.id,
        venueId: order.venue_id,
        totalAmount: order.total_amount,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        items: order.order_items || [],
        createdAt: order.created_at,
      })) || []
    );
  },

  order: async ({ id }: { id: string }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (*)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new Error(`Order not found: ${id}`);
    }

    return {
      id: data.id,
      venueId: data.venue_id,
      totalAmount: data.total_amount,
      orderStatus: data.order_status,
      paymentStatus: data.payment_status,
      items: data.order_items || [],
      createdAt: data.created_at,
    };
  },

  menu: async ({ venueId }: { venueId: string }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_available", true)
      .order("category", { ascending: true });

    if (error) {

      throw new Error(`Failed to fetch menu: ${error.message}`);
    }

    return (
      data?.map((item) => ({
        id: item.id,
        venueId: item.venue_id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        isAvailable: item.is_available,
      })) || []
    );
  },

  venue: async ({ id }: { id: string }) => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("venues").select("*").eq("id", id).single();

    if (error || !data) {
      throw new Error(`Venue not found: ${id}`);
    }

    return {
      id: data.id,
      name: data.venue_name,
      businessType: data.business_type,
      address: data.address,
    };
  },

  createOrder: async ({ input }: { input: CreateOrderInput }) => {
    const supabase = await createClient();

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        venue_id: input.venueId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        total_amount: input.items.reduce(
          (sum: number, item: OrderItemInput) => sum + item.price * item.quantity,
          0
        ),
        order_status: "PLACED",
        payment_status: "UNPAID",
      })
      .select()
      .single();

    if (orderError || !order) {

      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    // Create order items
    const orderItems = input.items.map((item: OrderItemInput) => ({
      order_id: order.id,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      price: item.price,
      item_name: item.itemName,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {

      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    return {
      id: order.id,
      venueId: order.venue_id,
      totalAmount: order.total_amount,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      items: orderItems,
      createdAt: order.created_at,
    };
  },

  updateOrderStatus: async ({ id, status }: { id: string; status: string }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .update({ order_status: status })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update order: ${error?.message || "Order not found"}`);
    }

    return {
      id: data.id,
      venueId: data.venue_id,
      totalAmount: data.total_amount,
      orderStatus: data.order_status,
      paymentStatus: data.payment_status,
      items: [],
      createdAt: data.created_at,
    };
  },
};

export const POST = withUnifiedAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { query, variables, operationName } = body;

    if (!query) {
      return NextResponse.json({ error: "GraphQL query is required" }, { status: 400 });
    }

    const result = await graphql({
      schema,
      source: query,
      rootValue,
      variableValues: variables,
      operationName,
    });

    if (result.errors) {

      return NextResponse.json(
        {
          data: result.data,
          errors: result.errors.map(
            (e: { message: string; locations?: unknown; path?: unknown }) => ({
              message: e.message,
              locations: e.locations,
              path: e.path,
            })
          ),
        },
        { status: 200 } // GraphQL returns 200 even with errors
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {

    return NextResponse.json(
      {
        errors: [
          {
            message: error instanceof Error ? error.message : "Internal server error",
          },
        ],
      },
      { status: 500 }
    );
  }
});

// GraphQL Playground endpoint (GET)
export const GET = async () => {
  return NextResponse.json({
    message: "GraphQL API",
    endpoint: "/api/graphql",
    playground: "Use POST to /api/graphql with GraphQL query",
    example: {
      query: `
        query {
          orders(venueId: "venue-id", limit: 10) {
            id
            totalAmount
            orderStatus
            items {
              itemName
              quantity
              price
            }
          }
        }
      `,
    },
  });
};
