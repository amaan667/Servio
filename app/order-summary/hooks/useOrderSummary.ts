import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface PendingOrderData {
  venueId: string;
  venueName: string;
  tableNumber: number;
  counterNumber?: string;
  orderType?: string;
  orderLocation?: string;
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>;
  total: number;
  customerName: string;
  customerPhone: string;
  orderId?: string;
  isDemo?: boolean;
  paymentMethod?: "PAY_NOW" | "PAY_LATER" | "PAY_AT_TILL";
  paymentMode?: "online" | "offline" | "deferred";
}

export function useOrderSummary() {
  const router = useRouter();
  const [orderData, setOrderData] = useState<PendingOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const storedData = localStorage.getItem("servio-pending-order");

    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setOrderData(data);
      } catch (_error) {
        // Don't redirect - let the parent component handle it
      }
    }
    // Don't redirect if no data - the page will show "No order data found" message
    setLoading(false);
  }, [router]);

  const handlePayNow = async () => {
    if (!orderData) {
      alert("Error: No order data available. Please try placing your order again.");
      return;
    }

    const isDemo = orderData.isDemo;

    if (isDemo) {
      const demoOrderId = `demo-${Date.now()}`;

      setIsCreatingOrder(true);

      try {
        const response = await fetch("/api/orders/create-demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId: orderData.venueId,
            venueName: orderData.venueName,
            tableNumber: orderData.tableNumber,
            counterNumber: orderData.counterNumber,
            orderType: orderData.orderType,
            orderLocation: orderData.orderLocation,
            cart: orderData.cart,
            total: orderData.total,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            orderId: demoOrderId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to create demo order");
        }

        localStorage.removeItem("servio-pending-order");
        localStorage.setItem("servio-last-order-id", demoOrderId);

        setOrderPlaced(true);

        setTimeout(() => {
          router.push(`/order-summary/${demoOrderId}`);
        }, 1500);
      } catch (_error) {
        alert("Error creating order. Please try again.");
      } finally {
        setIsCreatingOrder(false);
      }

      return;
    }

    setIsCreatingOrder(true);

    try {
      // Transform cart items to canonical /api/orders format
      const items = orderData.cart.map((item) => ({
        menu_item_id:
          item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
            ? item.id
            : null,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        special_instructions: item.specialInstructions || null,
      }));

      const isCounterOrder = !!orderData.counterNumber || orderData.orderType === "counter";

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: orderData.venueId,
          table_number: isCounterOrder ? null : orderData.tableNumber,
          customer_name: orderData.customerName,
          customer_phone: orderData.customerPhone,
          items,
          total_amount: orderData.total,
          payment_method: orderData.paymentMethod || "PAY_NOW",
          payment_mode: orderData.paymentMode || "online",
          source: isCounterOrder ? "counter" : "qr",
          qr_type: isCounterOrder ? "COUNTER" : "TABLE_FULL_SERVICE",
          counter_label: isCounterOrder
            ? orderData.counterNumber || `Counter ${orderData.tableNumber || "A"}`
            : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create order");
      }

      const orderId = result.data?.order?.id;
      localStorage.removeItem("servio-pending-order");
      localStorage.setItem("servio-last-order-id", orderId);

      setOrderPlaced(true);

      setTimeout(() => {
        router.push(`/payment?orderId=${orderId}&amount=${orderData.total}`);
      }, 1500);
    } catch (_error) {
      alert("Error creating order. Please try again.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return {
    orderData,
    loading,
    isCreatingOrder,
    orderPlaced,
    handlePayNow,
  };
}
