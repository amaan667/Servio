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
  counterNumber?: string; // Counter number for counter orders
  counterLabel?: string; // Counter label (e.g., "Counter 1", "Counter A")
  orderType?: "counter" | "table" | "table_pickup";
  qr_type?: "TABLE_FULL_SERVICE" | "TABLE_COLLECTION" | "COUNTER";
  requiresCollection?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  cart: CartItem[];
  total: number;
  notes?: string;
  source?: string;
  sessionId?: string | null;
  orderId?: string; // For existing orders when customer rescans QR
  orderNumber?: string; // For display purposes
}

export type PaymentAction = "demo" | "stripe" | "till" | "later";

export interface PaymentProcessingHandlers {
  setOrderNumber: (orderNumber: string) => void;
  setPaymentComplete: (complete: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
}
