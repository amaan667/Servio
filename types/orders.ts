// Unified order types for the new OrderCard component

import { OrderForEntityKind } from '@/lib/orders/entity-types';

export interface OrderForCard extends OrderForEntityKind {
  id: string;
  short_id: string;
  placed_at: string; // ISO string
  order_status: 'placed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  total_amount: number;
  currency: string; // "GBP"
  payment: {
    mode: 'online' | 'pay_at_till' | 'pay_later';
    status: 'paid' | 'unpaid' | 'failed' | 'refunded';
  };
  table_label?: string | null;     // "Table 10"
  counter_label?: string | null;   // "Counter A"  
  customer?: { name?: string; phone?: string } | null;
  items_preview?: string;          // precomputed "2x Burger, 1x Fries"
  items?: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
}

// Legacy order type mapping for backward compatibility
export interface LegacyOrder {
  id: string;
  venue_id: string;
  table_number: number;
  table_id?: string | null;
  session_id?: string | null;
  source?: "qr" | "counter";
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  total_amount: number;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
  created_at: string;
  updated_at: string;
  table_label?: string;
  counter_label?: string;
  table?: { is_configured: boolean } | null;
}
