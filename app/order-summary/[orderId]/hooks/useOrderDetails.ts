import { useState, useEffect, useRef, useCallback } from "react";
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
  order_type?: "table" | "counter" | "table_pickup"; // table_pickup = sit at table but collect at counter
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
  requires_collection?: boolean; // Alternative flag for collection requirement
}

export function useOrderDetails(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justBecameReady, setJustBecameReady] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const previousStatusRef = useRef<string | null>(null);

  // Play notification sound when order is ready
  const playReadySound = useCallback(() => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Pleasant chime pattern
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6
      oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.2); // E6

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Also try to vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } catch {
      // Audio not supported, silently fail
    }
  }, []);

  // Fetch order data
  const fetchOrder = useCallback(async () => {
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

      const orderData = data as Order;

      // Check if order just became READY
      if (
        previousStatusRef.current &&
        previousStatusRef.current !== "READY" &&
        orderData.order_status === "READY"
      ) {
        setJustBecameReady(true);
        playReadySound();

        toast({
          title: "🎉 Your order is ready!",
          description: "Please collect your order at the counter.",
          duration: 10000,
        });
      }

      previousStatusRef.current = orderData.order_status;
      setOrder(orderData);
      setLastUpdate(new Date());
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
  }, [orderId, playReadySound]);

  // Initial fetch and real-time subscription
  useEffect(() => {
    if (!orderId) return;

    fetchOrder();

    // Set up real-time subscription for order updates
    let channelRef: { unsubscribe: () => void } | null = null;

    const setupSubscription = async () => {
      const supabase = await createClient();

      const channel = supabase
        .channel(`order-status-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            const newOrderData = payload.new as Partial<Order>;
            const newStatus = newOrderData.order_status;

            // Check if order just became READY (or needs collection notification)
            const requiresCollectionNotification =
              newStatus === "READY" &&
              previousStatusRef.current !== "READY";

            if (requiresCollectionNotification) {
              setJustBecameReady(true);
              playReadySound();

              toast({
                title: "🎉 Your order is ready!",
                description: "Please collect your order at the counter.",
                duration: 10000,
              });
            }

            if (newStatus) {
              previousStatusRef.current = newStatus;
            }

            // Update order state - preserve items since realtime only sends flat order data
            setOrder((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                ...newOrderData,
                // Preserve items array since it's from a joined table
                items: prev.items,
              };
            });
            setLastUpdate(new Date());
          }
        )
        .subscribe();

      channelRef = {
        unsubscribe: () => {
          supabase.removeChannel(channel);
        },
      };
    };

    setupSubscription();

    return () => {
      channelRef?.unsubscribe();
    };
  }, [orderId, fetchOrder, playReadySound]);

  // Dismiss the ready alert
  const dismissReadyAlert = useCallback(() => {
    setJustBecameReady(false);
  }, []);

  return {
    order,
    loading,
    error,
    justBecameReady,
    dismissReadyAlert,
    lastUpdate,
    refetch: fetchOrder,
  };
}
