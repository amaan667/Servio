/**
 * Utility functions for consistent pricing calculations across the application
 */

export interface OrderItem {
  quantity: number;
  price: number;
  item_name?: string;
}

export interface Order {
  total_amount?: number;
  items: OrderItem[];
}

/**
 * Normalize a price value - handles both pence (>1000) and pounds format
 */
export function normalizePrice(price: number): number {
  if (!price || price <= 0) return 0;
  // If price is greater than 1000, assume it's in pence and convert to pounds
  return price > 1000 ? price / 100 : price;
}

/**
 * Calculate total from order items with fallback to total_amount
 */
export function calculateOrderTotal(order: Order): number {
  // First try to use total_amount if it exists and is valid
  if (order.total_amount && order.total_amount > 0) {
    return normalizePrice(order.total_amount);
  }

  // Calculate from items if total_amount is missing or zero
  if (order.items && order.items.length > 0) {
    return order.items.reduce((sum, item) => {
      const itemPrice = normalizePrice(item.price);
      const quantity = Number(item.quantity) || 0;
      return sum + itemPrice * quantity;
    }, 0);
  }

  return 0;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Format price with currency symbol
 */
export function formatPriceWithCurrency(amount: number, currency = "£"): string {
  return `${currency}${formatPrice(amount)}`;
}
