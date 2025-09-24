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
    let attemptCount = 0;
    const maxAttempts = 10; // Increased from 5 to 10 attempts
    
    async function verify() {
      if (stop || attemptCount >= maxAttempts) return;
      attemptCount++;
      
      try {
        console.log(`[SUCCESS PAGE] Verification attempt ${attemptCount}/${maxAttempts} for session:`, sessionId);
        
        // hits a server route that calls Stripe with secret key (never client)
        const res = await fetch(`/api/checkout/verify?orderId=${orderId}&sessionId=${sessionId}`, { cache: "no-store" });
        const json = await res.json();
        
        console.log(`[SUCCESS PAGE] Verification response:`, { status: res.status, paid: json.paid, orderId: json.orderId, error: json.error });
        
        if (!res.ok) {
          console.error(`[SUCCESS PAGE] Verification failed:`, json.error);
          if (attemptCount >= maxAttempts) {
            setState("error");
            return;
          }
          throw new Error(json.error || "verify failed");
        }
        
        if (json.paid) {
          console.log(`[SUCCESS PAGE] Payment verified successfully:`, json.orderId);
          setState("paid");
          if (json.orderId) {
            setRealOrderId(json.orderId);
          }
          stop = true; // Stop polling once payment is verified
        } else {
          console.log(`[SUCCESS PAGE] Payment not yet verified, attempt ${attemptCount}/${maxAttempts}`);
          if (attemptCount >= maxAttempts) {
            setState("unpaid");
          }
        }
      } catch (error) {
        console.error(`[SUCCESS PAGE] Verification error on attempt ${attemptCount}:`, error);
        if (attemptCount >= maxAttempts) {
          setState("error");
        }
      }
    }
    
    // Start verification immediately
    verify();

    // Poll every 2 seconds (reduced from 3 seconds for faster response)
    const t = setInterval(() => { if (!stop && attemptCount < maxAttempts) verify(); }, 2000);
    
    // Stop after 20 seconds (increased from 15 seconds)
    setTimeout(() => { 
      stop = true; 
      clearInterval(t); 
      if (state === "verifying") {
        console.log(`[SUCCESS PAGE] Verification timeout after ${maxAttempts} attempts`);
        setState("error");
      }
    }, 20000);
    
    return () => { stop = true; clearInterval(t); };
  }, [orderId, sessionId, state]);

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
                    onClick={() => {
                      // Get venue and table info from URL params to redirect back to customer flow
                      const urlParams = new URLSearchParams(window.location.search);
                      const venueId = urlParams.get('venueId') || 'venue-1e02af4d';
                      const tableNumber = urlParams.get('tableNumber') || '1';
                      window.location.href = `/order?venue=${venueId}&table=${tableNumber}`;
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Back to Ordering
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
                    onClick={() => {
                      // Get venue and table info from URL params to redirect back to customer flow
                      const urlParams = new URLSearchParams(window.location.search);
                      const venueId = urlParams.get('venueId') || 'venue-1e02af4d';
                      const tableNumber = urlParams.get('tableNumber') || '1';
                      window.location.href = `/order?venue=${venueId}&table=${tableNumber}`;
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Back to Ordering
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
