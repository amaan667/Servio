import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export interface OrderItem {

}

export interface Order {

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
