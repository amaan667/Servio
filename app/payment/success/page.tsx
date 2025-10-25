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

    // Webhook creates the order - just look it up and redirect
    const lookupOrder = async () => {
      console.info("🔍 [STRIPE SUCCESS] Looking up webhook-created order...");
      console.info("🎯 Session ID:", sessionId);

      try {
        // Try immediate lookup
        const response = await fetch(`/api/orders/by-session/${sessionId}`);
        console.info("📦 [STRIPE SUCCESS] Response:", response.status, response.ok);

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.order?.id) {
            console.info("✅ [STRIPE SUCCESS] Order found! ID:", data.order.id);
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${data.order.id}`;
            return;
          }
        }

        // Wait 3s for webhook to process
        console.info("⏳ [STRIPE SUCCESS] Waiting 3s for webhook...");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Retry
        const retryResponse = await fetch(`/api/orders/by-session/${sessionId}`);
        console.info("📦 [STRIPE SUCCESS] Retry response:", retryResponse.status, retryResponse.ok);

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.ok && retryData.order?.id) {
            console.info("✅ [STRIPE SUCCESS] Order found on retry! ID:", retryData.order.id);
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${retryData.order.id}`;
            return;
          }
        }

        // Still not found - webhook failed
        console.error("❌ [STRIPE SUCCESS] Webhook didn't create order");
        alert(
          `Payment successful but order not created. Please check Railway logs and contact support with session ID: ${sessionId}`
        );
        router.push("/");
      } catch (error) {
        console.error("❌ [STRIPE SUCCESS] Error:", error);
        alert(`Error finding order. Session ID: ${sessionId}`);
        router.push("/");
      }
    };

    lookupOrder();
  }, [sessionId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600">Finding your order...</p>
        <p className="text-sm text-gray-500 mt-2">Waiting for webhook...</p>
      </div>
    </div>
  );
}
