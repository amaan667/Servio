"use client";

import { useSearchParams } from "next/navigation";
import OrderSummary from "@/components/order-summary";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const orderId = searchParams?.get('orderId');
  const isDemo = searchParams?.get('demo') === '1';

  return (
    <OrderSummary 
      orderId={orderId || undefined}
      sessionId={sessionId || undefined}
      isDemo={isDemo}
    />
  );
}