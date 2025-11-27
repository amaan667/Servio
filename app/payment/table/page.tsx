"use client";

import { useSearchParams } from "next/navigation";
import { TablePaymentScreen } from "@/components/payment/TablePaymentScreen";

export default function TablePaymentPage() {
  const searchParams = useSearchParams();
  const venueId = searchParams?.get("venue") || "";
  const tableNumber = searchParams?.get("table") || "";

  if (!venueId || !tableNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900 mb-2">Invalid Request</p>
          <p className="text-gray-600">Venue ID and table number are required</p>
        </div>
      </div>
    );
  }

  return (
    <TablePaymentScreen
      venueId={venueId}
      tableNumber={parseInt(tableNumber)}
      onCancel={() => {
        window.location.href = `/order?venue=${venueId}&table=${tableNumber}`;
      }}
      onPaymentComplete={() => {
        // Redirect to order summary or success page
        window.location.href = `/order-summary?table=${tableNumber}&venue=${venueId}`;
      }}
    />
  );
}






