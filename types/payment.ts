/**
 * Payment-related types
 */

export interface CartItem {
  id?: string;
  menu_item_id?: string;
  quantity: number;
  price: number;
  name: string;
  specialInstructions?: string;
  image_url?: string;
}

export interface CheckoutData {
  venueId: string;
  venueName?: string;
  tableNumber?: number | string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  cart: CartItem[];
  total: number;
  notes?: string;
  source?: string;
  sessionId?: string | null;
}

export type PaymentAction = "demo" | "stripe" | "till" | "later";

export interface PaymentProcessingHandlers {
  setOrderNumber: (orderNumber: string) => void;
  setPaymentComplete: (complete: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
}
