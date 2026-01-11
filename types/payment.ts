/**
 * Payment-related types
 */

export interface CartItem {
  id?: string;
  menu_item_id?: string;

}

export interface CheckoutData {

  counterLabel?: string; // Counter label (e.g., "Counter 1", "Counter A")
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

}

export type PaymentAction = "demo" | "stripe" | "till" | "later";

export interface PaymentProcessingHandlers {

}
