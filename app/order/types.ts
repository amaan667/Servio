// Types for the order page

export interface ModifierOption {
  id: string;
  name: string;
  price: number; // Additional price (0 if free, positive for upcharge)
  isDefault?: boolean; // If this option should be pre-selected
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number; // Minimum selections required (0 if optional)
  maxSelections: number; // Maximum selections allowed (1 for radio, unlimited for checkbox)
  options: ModifierOption[];
}

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
  modifier_groups?: ModifierGroup[]; // New: proper modifier groups
  options?: Array<{ label: string; values: string[] }>; // Legacy format
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  options: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export interface CartItem extends MenuItem {
  quantity: number;
  specialInstructions?: string;
  selectedModifiers?: SelectedModifier[]; // New structured format
  modifierPrice?: number; // Total price modifier from all selected modifiers
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
