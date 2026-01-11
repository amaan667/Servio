import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export interface OrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string;
}

export interface Order {
  id: string;
  venue_id: string;
  table_number: number;
  counter_number?: number;
  order_type?: "table" | "counter";
  order_location?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  source?: "qr" | "counter";
}

export function useOrderDetails(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from("orders")
          .select(
            `
            *,
            order_items (
              menu_item_id,
              quantity,
              price,
              item_name,
              specialInstructions
            )
          `
          )
          .eq("id", orderId)
          .single();

        if (error) throw error;

        setOrder(data as Order);
      } catch (_err) {
        setError(_err instanceof Error ? _err.message : "Failed to load order details");
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  return {
    order,
    loading,
    error,
  };
}
