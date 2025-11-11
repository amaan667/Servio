"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

interface StripeSessionData {
  id: string;
  customer_email?: string;
  metadata: {
    full_name: string;
    tier: string;
  };
}

export default function CreateAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "form" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<StripeSessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    venueName: "",
    businessType: "Restaurant",
    serviceType: "table_service",
  });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionId = searchParams.get("session_id");
        if (!sessionId) {
          setError("No session ID found. Please start over.");
          setStatus("error");
          return;
        }

        // Fetch session details from our API
        const response = await fetch(`/api/stripe/checkout-session?session_id=${sessionId}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setStatus("error");
          return;
        }

        setSessionData(data);
        // Smart autofill: Use Stripe email if available, otherwise check for pending OAuth email
        const stripeEmail = data.customer_email;
        const pendingEmail =
          typeof window !== "undefined" ? sessionStorage.getItem("pending_signup_email") : null;
        const emailToUse = stripeEmail || pendingEmail || "";
        setFormData((prev) => ({ ...prev, email: emailToUse }));
        setStatus("form");
      } catch (_err) {
        setError(_err instanceof Error ? _err.message : "Failed to fetch session details.");
        setStatus("error");
      }
    };

    fetchSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/signup/with-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email, // Use form data email (editable by user)
          password: formData.password,
          fullName: sessionData?.metadata.full_name,
          venueName: formData.venueName,
          venueType: formData.businessType,
          serviceType: formData.serviceType,
          tier: sessionData?.metadata.tier,
          stripeSessionId: sessionData?.id,
        }),
      });

      const data = await response.json();

      if (data.error || !data.success) {
        setError(data.error || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      setStatus("success");
      setTimeout(() => {
        router.push(`/onboarding/venue-setup`);
      }, 2000);
    } catch (_err) {
      setError(
        _err instanceof Error ? _err.message : "Failed to create account. Please try again."
      );
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Payment Successful!</CardTitle>
            <CardDescription>Please complete your account details...</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600">Loading your details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "form" && sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <NavigationBreadcrumb showBackButton={false} />
            <CardTitle className="text-2xl font-bold">Complete Your Account</CardTitle>
            <CardDescription>
              Payment successful! Create your password and business details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  disabled={loading}
                  required
                />
                <p className="text-xs text-gray-500">
                  {sessionData?.customer_email &&
                    "Pre-filled from your account • You can change this if needed"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Create a password"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueName">Business Name</Label>
                <Input
                  id="venueName"
                  type="text"
                  value={formData.venueName}
                  onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
                  placeholder="Enter your business name"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <select
                  id="businessType"
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-black focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="Restaurant">Restaurant</option>
                  <option value="Cafe">Cafe</option>
                  <option value="Coffee Shop">Coffee Shop</option>
                  <option value="Bar">Bar</option>
                  <option value="Food Truck">Food Truck</option>
                  <option value="Takeaway">Takeaway</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Fast Food">Fast Food</option>
                  <option value="Fine Dining">Fine Dining</option>
                  <option value="Casual Dining">Casual Dining</option>
                  <option value="Pizzeria">Pizzeria</option>
                  <option value="Bistro">Bistro</option>
                  <option value="Pub">Pub</option>
                  <option value="Brewery">Brewery</option>
                  <option value="Juice Bar">Juice Bar</option>
                  <option value="Ice Cream Shop">Ice Cream Shop</option>
                  <option value="Deli">Deli</option>
                  <option value="Catering">Catering</option>
                  <option value="Food Court">Food Court</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type</Label>
                <select
                  id="serviceType"
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-black focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="table_service">Table Service (QR codes on tables)</option>
                  <option value="counter_pickup">
                    Pickup/Counter Service (QR codes for orders)
                  </option>
                </select>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account & Start Trial"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Account Created!</CardTitle>
            <CardDescription>Your account is ready...</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-gray-600 mb-4">Account created successfully!</p>
            <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Error</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/sign-up")}
            className="text-purple-600 hover:underline"
          >
            Go back to sign up
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
