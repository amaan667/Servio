"use client";

import { useSearchParams } from "next/navigation";
import OrderSummary from "@/components/order-summary";
import { useEffect, useState } from "react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");
  const orderId = searchParams?.get("orderId");
  const isDemo = searchParams?.get("demo") === "1";
  const paymentMethod = searchParams?.get("paymentMethod") || "demo";
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | undefined>(orderId || undefined);
  const [demoOrderData, setDemoOrderData] = useState<unknown>(null);

  // URL parameter fallbacks
  const customerNameParam = searchParams?.get("customerName");
  const totalParam = searchParams?.get("total");
  const venueNameParam = searchParams?.get("venueName");

  useEffect(() => {
    console.info("🎬 [PAYMENT SUCCESS] Effect triggered", {
      sessionId,
      orderId,
      isDemo,
      hasCheckoutData: !!localStorage.getItem("servio-checkout-data"),
    });

    // Handle Stripe payment success - CREATE ORDER NOW
    if (sessionId && !orderId && !isDemo) {
      console.info("💳 [STRIPE SUCCESS] Processing Stripe payment success...");
      // Check if we have pending order creation
      const checkoutDataStr = localStorage.getItem("servio-checkout-data");

      if (checkoutDataStr) {
        console.info("✅ [STRIPE SUCCESS] Found checkout data in localStorage");
        try {
          const checkoutData = JSON.parse(checkoutDataStr);
          console.info("✅ [STRIPE SUCCESS] Parsed checkout data:", {
            venueId: checkoutData.venueId,
            customerName: checkoutData.customerName,
            customerPhone: checkoutData.customerPhone,
            cartLength: checkoutData.cart?.length,
            total: checkoutData.total,
            pendingOrderCreation: checkoutData.pendingOrderCreation,
          });

          if (checkoutData.pendingOrderCreation) {
            console.info("💳 [STRIPE SUCCESS] Payment successful - creating order in database NOW");

            // Create order now that payment succeeded
            const orderData = {
              venue_id: checkoutData.venueId,
              table_number: checkoutData.tableNumber,
              table_id: null,
              counter_number: checkoutData.counterNumber || null,
              order_type: checkoutData.orderType || "table",
              order_location:
                checkoutData.orderLocation || checkoutData.tableNumber?.toString() || "1",
              customer_name: checkoutData.customerName,
              customer_phone: checkoutData.customerPhone,
              items: checkoutData.cart.map(
                (item: {
                  id?: string;
                  quantity: number;
                  price: number;
                  name: string;
                  specialInstructions?: string;
                }) => ({
                  menu_item_id: item.id || "unknown",
                  quantity: item.quantity,
                  price: item.price,
                  item_name: item.name,
                  specialInstructions: item.specialInstructions || null,
                })
              ),
              total_amount: checkoutData.total,
              notes: checkoutData.notes || "",
              order_status: "IN_PREP", // Start as IN_PREP so it shows in Live Orders immediately as "Preparing"
              payment_status: "PAID",
              payment_mode: "online",
              payment_method: "stripe",
              session_id: checkoutData.sessionId,
              source: checkoutData.source || "qr",
              stripe_session_id: sessionId,
            };

            console.info("📤 [STRIPE SUCCESS] POST /api/orders starting...", {
              venue_id: orderData.venue_id,
              customer_name: orderData.customer_name,
              items_count: orderData.items.length,
              total_amount: orderData.total_amount,
              order_status: orderData.order_status,
              payment_status: orderData.payment_status,
            });

            fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(orderData),
            })
              .then(async (response) => {
                console.info("📦 [STRIPE SUCCESS] POST /api/orders response received", {
                  status: response.status,
                  ok: response.ok,
                  statusText: response.statusText,
                });

                const result = await response.json();
                console.info("📦 [STRIPE SUCCESS] Response body:", {
                  ok: result.ok,
                  hasOrder: !!result.order,
                  orderId: result.order?.id,
                  orderStatus: result.order?.order_status,
                  paymentStatus: result.order?.payment_status,
                  error: result.error,
                });

                if (result.ok && result.order?.id) {
                  console.info("✅ [STRIPE SUCCESS] Order created successfully!", {
                    orderId: result.order.id,
                    orderStatus: result.order.order_status,
                    paymentStatus: result.order.payment_status,
                  });
                  localStorage.removeItem("servio-checkout-data");

                  // Redirect to unified order summary page
                  console.info("🔄 [STRIPE SUCCESS] Redirecting to order summary...");
                  window.location.href = `/order-summary?orderId=${result.order.id}`;
                } else {
                  console.error("❌ [STRIPE SUCCESS] Order creation failed:", result.error);
                  alert(
                    `Order creation failed: ${result.error || "Unknown error"}. Please contact support with session ID: ${sessionId}`
                  );
                  // Try to redirect to order summary with session ID as fallback
                  window.location.href = `/order-summary?session_id=${sessionId}`;
                }
              })
              .catch((error) => {
                console.error("❌ [STRIPE SUCCESS] Network error creating order:", {
                  message: error.message,
                  stack: error.stack,
                });
                alert(
                  `Network error creating order: ${error.message}. Please contact support with session ID: ${sessionId}`
                );
                // Redirect anyway - maybe order was created but response failed
                window.location.href = `/order-summary?session_id=${sessionId}`;
              });
          } else {
            console.warn("⚠️  [STRIPE SUCCESS] pendingOrderCreation flag is FALSE or missing!");
            console.warn("⚠️  Checkout data:", checkoutData);
            // Try to look up order anyway
            console.info("🔄 [STRIPE SUCCESS] Attempting fallback lookup by session_id...");
            fetch(`/api/orders/by-session/${sessionId}`)
              .then((response) => response.json())
              .then((data) => {
                console.info("📦 [STRIPE SUCCESS] Fallback lookup result:", data);
                if (data.ok && data.orderId) {
                  setVerifiedOrderId(data.orderId);
                  console.info("✅ [STRIPE SUCCESS] Found existing order:", data.orderId);
                } else {
                  console.error("❌ [STRIPE SUCCESS] No order found for session");
                }
              })
              .catch((error) => {
                console.error("❌ [STRIPE SUCCESS] Fallback lookup failed:", error);
              });
          }
        } catch (parseError) {
          console.error("❌ [STRIPE SUCCESS] Error parsing checkout data:", {
            error: parseError,
            checkoutDataStr: checkoutDataStr?.substring(0, 200),
          });
        }
      } else {
        console.warn("⚠️  [STRIPE SUCCESS] No checkout data in localStorage");
        // Fallback: Try to look up existing order by stripe_session_id
        console.info("🔄 [STRIPE SUCCESS] Attempting lookup by session_id...");
        fetch(`/api/orders/by-session/${sessionId}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.ok && data.orderId) {
              setVerifiedOrderId(data.orderId);
            }
          })
          .catch((error) => {
            console.error("❌ [STRIPE SUCCESS] Error looking up order:", error);
          });
      }
    }

    if (isDemo && orderId) {
      // Check localStorage for demo order data
      const storedData = localStorage.getItem("demo-order-data");

      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setDemoOrderData(data);

          // Clean up after loading
          localStorage.removeItem("demo-order-data");
        } catch {
          // Error silently handled
        }
      } else {
        // Fallback: try to reconstruct order from URL parameters
        if (customerNameParam && totalParam && venueNameParam) {
          const reconstructedData = {
            id: orderId || `demo-${Date.now()}`,
            venue_id: "demo-cafe",
            venue_name: venueNameParam || "Demo Café",
            table_number: 1,
            order_status: "IN_PREP", // Start as IN_PREP so demo orders also show in Live Orders
            payment_status: "PAID",
            payment_method: paymentMethod || "demo",
            customer_name: customerNameParam || "Demo Customer",
            customer_phone: "",
            total_amount: parseFloat(totalParam || "0"),
            items: [],
            created_at: new Date().toISOString(),
          };
          setDemoOrderData(reconstructedData);
        }
      }
    }
  }, [isDemo, orderId, customerNameParam, totalParam, venueNameParam, paymentMethod, sessionId]);

  // Use the same OrderSummary component for both demo and real orders
  return (
    <OrderSummary
      orderId={verifiedOrderId}
      sessionId={sessionId || undefined}
      orderData={demoOrderData}
      isDemo={isDemo}
    />
  );
}
