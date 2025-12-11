// Test script to verify the unified OrderCard system works correctly

import { deriveEntityKind } from "./entity-types";
import { mapOrderToCardData } from "./mapOrderToCardData";
import { mapCounterOrderToCardData } from "./mapCounterOrderToCardData";
import type { LegacyOrder } from "@/types/orders";
import type { CounterOrder } from "@/hooks/useCounterOrders";
import { logger } from "@/lib/logger";

// Test 1: Table order (has table_id and is_configured: true)
const tableOrder: LegacyOrder = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  venue_id: "venue-1",
  table_number: 10,
  table_id: "table-10",
  customer_name: "John Doe",
  customer_phone: "+44123456789",
  order_status: "PLACED",
  payment_status: "UNPAID",
  total_amount: 25.5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  items: [{ menu_item_id: "1", quantity: 2, price: 12.75, item_name: "Burger" }],
  source: "qr",
  table_label: "Table 10",
  table: { is_configured: true },
};

const tableCardData = mapOrderToCardData(tableOrder);
logger.debug("[TEST] Table card data:", {
  id: tableCardData.short_id,
  table_label: tableCardData.table_label,
  counter_label: tableCardData.counter_label,
  payment: tableCardData.payment,
});

// Test 2: Counter order
const counterOrder: CounterOrder = {
  id: "456e7890-e89b-12d3-a456-426614174001",
  table_number: 5,
  customer_name: "Jane Smith",
  customer_phone: "+44987654321",
  order_status: "READY",
  payment_status: "PAID",
  total_amount: 18.75,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  source: "counter",
  items: [{ item_name: "Coffee", quantity: 2, price: 9.375 }],
};

const counterCardData = mapCounterOrderToCardData(counterOrder);
logger.debug("[TEST] Counter card data:", {
  id: counterCardData.short_id,
  table_label: counterCardData.table_label,
  counter_label: counterCardData.counter_label,
  payment: counterCardData.payment,
});

// Test 3: Unassigned order (no table_id, no table relationship)
const unassignedOrder: LegacyOrder = {
  ...tableOrder,
  table_id: null,
  table: null,
  table_label: undefined,
};

const unassignedCardData = mapOrderToCardData(unassignedOrder);
logger.debug("[TEST] Unassigned card data:", {
  id: unassignedCardData.short_id,
  table_label: unassignedCardData.table_label,
  counter_label: unassignedCardData.counter_label,
});
