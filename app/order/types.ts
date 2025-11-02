// Types for the order page

export interface MenuItem {
  id: string;
  venue_id?: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  image_url?: string | null;
  is_available: boolean;
  created_at?: string;
  venue_name?: string;
  options?: Array<{ label: string; values: string[] }>;
}

export interface CartItem extends MenuItem {
  quantity: number;
  specialInstructions?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
}

export interface OrderParams {
  venueSlug: string;
  tableNumber: string;
  counterNumber: string;
  isDemo: boolean;
  isCounterOrder: boolean;
  orderLocation: string;
  orderType: "counter" | "table";
}
