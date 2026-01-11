/**
 * Order API Type Definitions
 */

export interface OrderPayload {

}

export interface OrderItem {
  menu_item_id?: string | null;

}

export interface OrderResponse {

  order?: Record<string, unknown>;
  table_auto_created?: boolean;
  table_id?: string | null;
  session_id?: string | null;
  source?: string;
  display_name?: string;
  duplicate?: boolean;
  error?: string;
}
