// Types for the order page

export interface MenuItem {

  options?: Array<{ label: string; values: string[] }>;
}

export interface CartItem extends MenuItem {

  selectedModifiers?: Record<string, string[]>; // Modifier name -> selected option names
  modifierPrice?: number; // Total price modifier from all selected modifiers
}

export interface CustomerInfo {

}

export interface OrderParams {

}
