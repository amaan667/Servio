"use client";

import OrderSummary from "@/components/order-summary";

export default function DemoOrderSummaryPage() {
  // Demo order data
  const demoOrder = {
    id: 'demo-order-123456',
    venue_id: 'venue-1e02af4d',
    table_number: 5,
    customer_name: 'John Smith',
    customer_phone: '+44 123 456 7890',
    customer_email: 'john@example.com',
    order_status: 'IN_PREP',
    total_amount: 24.50,
    notes: 'Extra crispy fries please',
    payment_method: 'demo',
    payment_status: 'PAID',
    source: 'qr',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: '1',
        menu_item_id: 'item-1',
        item_name: 'Beef Burger',
        quantity: 1,
        price: 12.50,
        special_instructions: 'No pickles, extra cheese'
      },
      {
        id: '2',
        menu_item_id: 'item-2',
        item_name: 'French Fries',
        quantity: 2,
        price: 4.50,
        special_instructions: 'Extra crispy'
      },
      {
        id: '3',
        menu_item_id: 'item-3',
        item_name: 'Soft Drink',
        quantity: 1,
        price: 3.00,
        special_instructions: null
      }
    ]
  };

  return (
    <OrderSummary 
      orderData={demoOrder}
      isDemo={true}
    />
  );
}
