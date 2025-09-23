"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import Image from "next/image";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("orderId") as string | undefined;
  const sessionId = searchParams?.get("session_id") as string | undefined;
  const [state, setState] = useState<"verifying"|"paid"|"unpaid"|"error">("verifying");
  const [realOrderId, setRealOrderId] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function verify() {
      try {
        // hits a server route that calls Stripe with secret key (never client)
        const res = await fetch(`/api/checkout/verify?orderId=${orderId}&sessionId=${sessionId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "verify failed");
        
        if (json.paid) {
          setState("paid");
          if (json.orderId) {
            setRealOrderId(json.orderId);
          }
        } else {
          setState("unpaid");
        }
      } catch {
        setState("error");
      }
    }
    verify();

    // optional: poll for a few seconds if webhook is slightly delayed
    const t = setInterval(() => { if (!stop) verify(); }, 3000);
    setTimeout(() => { stop = true; clearInterval(t); }, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [orderId, sessionId]);

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
              className="h-20 sm:h-24 md:h-28 lg:h-32 xl:h-36 w-auto"
              priority
            />
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 text-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "verifying" && (
              <>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Finalising your payment…</h2>
                <p className="text-gray-600">Please wait while we confirm your payment.</p>
              </>
            )}
            
            {state === "paid" && (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-green-900">Payment Successful!</h2>
                <p className="text-gray-600">
                  ✅ Payment received. Thanks! Your order #{realOrderId?.slice(-6) || orderId?.slice(-6)} is being prepared.
                </p>
                <div className="pt-4 space-y-3">
                  <Button 
                    onClick={() => window.location.href = `/order-summary/${realOrderId || orderId}`}
                    className="w-full bg-servio-purple hover:bg-servio-purple-dark"
                  >
                    View Order Summary
                  </Button>
                  <Button 
                    onClick={() => window.location.href = '/'}
                    variant="outline"
                    className="w-full"
                  >
                    Return to Home
                  </Button>
                </div>
              </>
            )}
            
            {state === "unpaid" && (
              <>
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-xl font-semibold text-yellow-900">Payment Processing</h2>
                <p className="text-gray-600">
                  We didn't receive a payment yet. If you paid, this will update shortly.
                </p>
                <div className="pt-4">
                  <Button 
                    onClick={() => window.location.href = '/'}
                    variant="outline"
                    className="w-full"
                  >
                    Return to Home
                  </Button>
                </div>
              </>
            )}
            
            {state === "error" && (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-red-900">Verification Error</h2>
                <p className="text-gray-600">
                  We couldn't verify the payment. Please ask a staff member or try again.
                </p>
                <div className="pt-4">
                  <Button 
                    onClick={() => window.location.href = '/'}
                    variant="outline"
                    className="w-full"
                  >
                    Return to Home
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
