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

    // Webhook already created the order - just look it up and redirect
    const lookupAndRedirect = async () => {
      console.info("🔍 [STRIPE SUCCESS] Looking up order by stripe session_id...");

      try {
        // Try to find the order created by the webhook
        const response = await fetch(`/api/orders/by-session/${sessionId}`);
        console.info("📦 [STRIPE SUCCESS] Lookup response:", response.status, response.ok);

        if (response.ok) {
          const data = await response.json();
          console.info("✅ [STRIPE SUCCESS] Lookup result:", {
            ok: data.ok,
            hasOrder: !!data.order,
            orderId: data.order?.id,
          });

          if (data.ok && data.order?.id) {
            // Found it! Redirect to order summary
            console.info("✅ [STRIPE SUCCESS] Order found! Redirecting to order summary...");
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${data.order.id}`;
            return;
          }
        }

        // If not found yet, wait and retry (webhook might be processing)
        console.warn("⚠️  [STRIPE SUCCESS] Order not found yet, retrying in 2s...");
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Retry
        const retryResponse = await fetch(`/api/orders/by-session/${sessionId}`);
        console.info("📦 [STRIPE SUCCESS] Retry response:", retryResponse.status, retryResponse.ok);

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          console.info("✅ [STRIPE SUCCESS] Retry result:", {
            ok: retryData.ok,
            hasOrder: !!retryData.order,
            orderId: retryData.order?.id,
          });

          if (retryData.ok && retryData.order?.id) {
            console.info("✅ [STRIPE SUCCESS] Order found on retry! Redirecting...");
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${retryData.order.id}`;
            return;
          }
        }

        // Still not found - webhook might have failed
        console.error("❌ [STRIPE SUCCESS] Order not found after retry");
        alert(
          `Payment successful but order not found. Please contact support with session ID: ${sessionId}`
        );
        router.push("/");
      } catch (error) {
        console.error("❌ [STRIPE SUCCESS] Error looking up order:", error);
        alert(`Error finding order. Please contact support with session ID: ${sessionId}`);
        router.push("/");
      }
    };

    lookupAndRedirect();
  }, [sessionId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600">Finding your order...</p>
      </div>
    </div>
  );
}
