"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams?.get("session_id");

  useEffect(() => {

    if (!sessionId) {
      router.push("/");
      return;
    }

    // Webhook updates the order - just look it up and redirect
    const lookupOrder = async () => {

      try {
        // Wait 1s for webhook to update order
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Look up order by session ID
        const response = await fetch(`/api/orders/by-session/${sessionId}`);

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.order?.id) {
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${data.order.id}`;
            return;
          }
        }

        // Retry once more
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const retryResponse = await fetch(`/api/orders/by-session/${sessionId}`);

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.ok && retryData.order?.id) {
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${retryData.order.id}`;
            return;
          }
        }

        // Still not found - webhook failed
        alert(
          `Payment successful but order not updated. Please check Railway logs. Session ID: ${sessionId}`
        );
        router.push("/");
      } catch (_error) {
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
