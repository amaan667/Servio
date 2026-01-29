"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { safeGetItem } from "@/app/order/utils/safeStorage";

export default function PaymentCancelPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams?.get("orderId") as string | undefined;
  let venueId = searchParams?.get("venueId") as string | undefined;
  let tableNumber = searchParams?.get("tableNumber") as string | undefined;

  if ((!venueId || !tableNumber) && typeof window !== "undefined") {
    const stored = safeGetItem(localStorage, "servio-checkout-data");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        venueId = venueId || data.venueId;
        tableNumber = tableNumber || String(data.tableNumber ?? "1");
      } catch {
        // ignore
      }
    }
  }

  const backToOrderUrl =
    venueId && tableNumber
      ? `/order?venue=${encodeURIComponent(venueId)}&table=${encodeURIComponent(tableNumber)}`
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <Image
              src="/assets/servio-logo-updated.png"
              alt="Servio"
              width={300}
              height={90}
              className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto"
              priority
            />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 text-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center">Payment Cancelled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-red-900">Payment Cancelled</h2>
            <p className="text-gray-900">
              Your payment was cancelled. No charges have been made. Your cart is still saved — you
              can go back and choose a different payment method.
              {orderId && ` Order #${orderId.slice(-6)} is still pending.`}
            </p>
            <div className="pt-4 space-y-2">
              {backToOrderUrl && (
                <Button
                  onClick={() => router.push(backToOrderUrl)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to order
                </Button>
              )}
              {!backToOrderUrl && (
                <Button onClick={() => router.push("/")} className="w-full bg-blue-600 hover:bg-blue-700">
                  Back to home
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
