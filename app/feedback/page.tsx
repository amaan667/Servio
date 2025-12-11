"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import UnifiedFeedbackForm from "@/components/UnifiedFeedbackForm";

export default function FeedbackPage() {
  const searchParams = useSearchParams();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    const venueIdParam = searchParams?.get("venueId") || null;
    const orderIdParam = searchParams?.get("orderId") || null;
    const customerNameParam = searchParams?.get("customerName") || null;

    setVenueId(venueIdParam);
    setOrderId(orderIdParam);
    setCustomerName(customerNameParam);
  }, [searchParams]);

  if (!venueId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Feedback</h1>
          <p className="text-gray-900">Please provide a venue ID to access the feedback form.</p>
          <p className="text-sm text-gray-900 mt-2">Example: /feedback?venueId=your-venue-id</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <UnifiedFeedbackForm
        venueId={venueId}
        orderId={orderId || undefined}
        customerName={customerName || undefined}
      />
    </div>
  );
}
