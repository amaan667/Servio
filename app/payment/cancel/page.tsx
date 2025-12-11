"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import Image from "next/image";

export default function PaymentCancelPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams?.get("orderId") as string | undefined;
  const venueId = searchParams?.get("venueId") as string | undefined;
  const tableNumber = searchParams?.get("tableNumber") as string | undefined;

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
              Your payment was cancelled. No charges have been made.
              {orderId && ` Your order #${orderId.slice(-6)} is still pending.`}
            </p>
            <div className="pt-4 space-y-2">
              <Button
                onClick={() => {
                  if (venueId && tableNumber) {
                    router.push(`/order?venue=${venueId}&table=${tableNumber}`);
                  } else {
                    router.push("/");
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Start New Order
              </Button>
              <Button onClick={() => router.back()} variant="outline" className="w-full">
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
