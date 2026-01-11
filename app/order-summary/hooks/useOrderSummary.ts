
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
      const response = await fetch("/api/orders/create", {
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
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create order");
      }

      localStorage.removeItem("servio-pending-order");
      localStorage.setItem("servio-last-order-id", result.orderId);

      setOrderPlaced(true);

      setTimeout(() => {
        router.push(`/payment?orderId=${result.orderId}&amount=${orderData.total}`);
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
