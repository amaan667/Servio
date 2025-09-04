"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from "lucide-react";

// Dynamically import the checkout client component to prevent SSR
const CheckoutClient = dynamic(() => import('./checkout-client'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-servio-purple" />
        <p className="text-gray-600">Loading checkout...</p>
        <p className="text-sm text-gray-500 mt-2">Preparing your order details...</p>
      </div>
    </div>
  ),
});

export default function CheckoutPage() {
  return <CheckoutClient />;
}
