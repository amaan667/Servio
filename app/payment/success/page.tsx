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

    // Webhook should update the order; however if delayed/missed, reconcile via /api/orders/verify.
    const lookupOrder = async () => {
      try {
        // Wait briefly for webhook to update order
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Reconcile payment status in case webhook is delayed/missed (idempotent)
        await fetch(`/api/orders/verify?sessionId=${encodeURIComponent(sessionId)}`).catch(() => {
          // Non-blocking: fallback still tries to find the order and redirect
        });

        // Look up order by session ID
        const response = await fetch(
          `/api/orders/by-session?sessionId=${encodeURIComponent(sessionId)}`
        );

        if (response.ok) {
          const data = await response.json();
          // Check for both response formats: { order: ... } and { ok: true, order: ... }
          const order = data.order || (data.ok && data.order);
          if (order?.id) {
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${order.id}`;
            return;
          }
        }

        // Retry once more after a longer delay (webhook may take time)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Retry reconcile once more as well (idempotent)
        await fetch(`/api/orders/verify?sessionId=${encodeURIComponent(sessionId)}`).catch(() => {
          // Non-blocking
        });

        const retryResponse = await fetch(
          `/api/orders/by-session?sessionId=${encodeURIComponent(sessionId)}`
        );

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryOrder = retryData.order || (retryData.ok && retryData.order);
          if (retryOrder?.id) {
            localStorage.removeItem("servio-checkout-data");
            window.location.href = `/order-summary?orderId=${retryOrder.id}`;
            return;
          }
        }

        // Still not found - try to get orderId from URL params or show user-friendly message
        const orderIdFromUrl = searchParams?.get("orderId");
        if (orderIdFromUrl) {
          localStorage.removeItem("servio-checkout-data");
          window.location.href = `/order-summary?orderId=${orderIdFromUrl}`;
          return;
        }

        // Last resort: show user-friendly error
        alert(
          "Payment was successful! However, we couldn't find your order details. Please contact support with this session ID: " +
            sessionId
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
