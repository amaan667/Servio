// Unified order types for the new OrderCard component

import { OrderForEntityKind } from "@/lib/orders/entity-types";

export interface OrderForCard extends OrderForEntityKind {

    method?: string; // Payment method: PAY_NOW, PAY_LATER, PAY_AT_TILL
  };
  table_number?: number | null;
  table_label?: string | null; // "Table 10"
  counter_label?: string | null; // "Counter A"
  customer?: { name?: string; phone?: string } | null;
  customer_name?: string;
  customer_phone?: string;
  payment_status?: string;
  payment_mode?: string;
  payment_method?: string; // Raw payment_method from database
  items_preview?: string; // precomputed "2x Burger, 1x Fries"
  items?: Array<{

  }>;
}

// Legacy order type mapping for backward compatibility
export interface LegacyOrder {

  }>;

  table?: { is_configured: boolean } | null;
}
