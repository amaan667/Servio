"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams?.get("session_id");

  useEffect(() => {
    console.info("🎬 [STRIPE SUCCESS] Payment success page loaded", { sessionId });

    if (!sessionId) {
      console.error("❌ [STRIPE SUCCESS] No session_id in URL");
      router.push("/");
      return;
    }

    // Try webhook-created order first, create as fallback if needed
    const lookupOrCreateOrder = async () => {
      console.info("\n" + "=".repeat(80));
      console.info("🔍 [STRIPE SUCCESS] Starting order lookup/creation...");
      console.info("=".repeat(80));
      console.info("🎯 Session ID:", sessionId);
      console.info("=".repeat(80) + "\n");

      try {
        // STEP 1: Try to find webhook-created order
        console.info("📡 [STRIPE SUCCESS] Step 1: Looking for webhook-created order...");
        const response = await fetch(`/api/orders/by-session/${sessionId}`);
        console.info("📦 [STRIPE SUCCESS] Response:", response.status, response.ok);

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.order?.id) {
            console.info("✅ [STRIPE SUCCESS] Webhook created order! ID:", data.order.id);
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${data.order.id}`;
            return;
          }
        }

        // STEP 2: Wait 2s for webhook
        console.warn("⚠️  [STRIPE SUCCESS] No order yet, waiting 2s for webhook...");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const retryResponse = await fetch(`/api/orders/by-session/${sessionId}`);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.ok && retryData.order?.id) {
            console.info(
              "✅ [STRIPE SUCCESS] Webhook created order (after wait)! ID:",
              retryData.order.id
            );
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${retryData.order.id}`;
            return;
          }
        }

        // STEP 3: Webhook didn't create order - create it ourselves
        console.warn("\n" + "=".repeat(80));
        console.warn("⚠️  [STRIPE SUCCESS] WEBHOOK DIDN'T CREATE ORDER");
        console.warn("⚠️  Creating order as fallback...");
        console.warn("=".repeat(80) + "\n");

        const checkoutDataStr = localStorage.getItem("servio-checkout-data");
        if (!checkoutDataStr) {
          throw new Error("No checkout data in localStorage");
        }

        const checkoutData = JSON.parse(checkoutDataStr);
        console.info("✅ [STRIPE SUCCESS] Retrieved checkout data");
        console.info("📋 Venue:", checkoutData.venueId);
        console.info("📋 Customer:", checkoutData.customerName);
        console.info("📋 Table:", checkoutData.tableNumber);
        console.info("📋 Items:", checkoutData.cart?.length);

        const orderData = {
          venue_id: checkoutData.venueId,
          table_number: checkoutData.tableNumber,
          table_id: null,
          counter_number: checkoutData.counterNumber || null,
          order_type: checkoutData.orderType || "table",
          order_location: checkoutData.orderLocation || checkoutData.tableNumber?.toString() || "1",
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
          order_status: "IN_PREP",
          payment_status: "PAID",
          payment_mode: "online",
          payment_method: "stripe",
          session_id: checkoutData.sessionId,
          source: checkoutData.source || "qr",
          stripe_session_id: sessionId,
        };

        console.info("📤 [STRIPE SUCCESS] POST /api/orders (fallback)...");
        const createResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        });

        console.info(
          "📦 [STRIPE SUCCESS] Create response:",
          createResponse.status,
          createResponse.ok
        );

        if (createResponse.ok) {
          const result = await createResponse.json();
          console.info("\n" + "=".repeat(80));
          console.info("✅ [STRIPE SUCCESS] ORDER CREATED VIA FALLBACK!");
          console.info("=".repeat(80));
          console.info("🆔 Order ID:", result.order?.id);
          console.info("📊 Status:", result.order?.order_status);
          console.info("💳 Payment:", result.order?.payment_status);
          console.info("=".repeat(80) + "\n");

          localStorage.removeItem("servio-checkout-data");
          window.location.href = `/order-summary?orderId=${result.order.id}`;
          return;
        } else {
          const errorData = await createResponse.json();
          throw new Error(errorData.error || "Failed to create order");
        }
      } catch (error) {
        console.error("\n" + "=".repeat(80));
        console.error("❌ [STRIPE SUCCESS] FATAL ERROR");
        console.error("=".repeat(80));
        console.error("❌ Error:", error);
        console.error("❌ Message:", error instanceof Error ? error.message : String(error));
        console.error("=".repeat(80) + "\n");

        alert(
          `Payment successful but order could not be created. Please contact support with session ID: ${sessionId}`
        );
        router.push("/");
      }
    };

    lookupOrCreateOrder();
  }, [sessionId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600">Processing your order...</p>
        <p className="text-sm text-gray-500 mt-2">This may take a few seconds...</p>
      </div>
    </div>
  );
}
