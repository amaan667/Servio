"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabaseBrowser } from "@/lib/supabase";
import Link from "next/link";
import { Check, Loader2, Mail } from "lucide-react";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

interface SignUpFormProps {
  onGoogleSignIn: () => Promise<void>;
  isSigningUp?: boolean;
}

export default function SignUpForm({ onGoogleSignIn, isSigningUp = false }: SignUpFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"tier" | "form">("tier");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationVenueId, setInvitationVenueId] = useState<string | null>(null);
  const [invitationRole, setInvitationRole] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    venueName: "",
    businessType: "Restaurant",
    serviceType: "table_service", // 'table_service' or 'counter_pickup'
  });

  // Pre-fill email and check for invitation params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const emailParam = urlParams.get("email");
      const invitationParam = urlParams.get("invitation");
      const venueParam = urlParams.get("venue");
      const roleParam = urlParams.get("role");

      // If invitation signup, pre-populate email and skip tier selection
      if (invitationParam && emailParam && venueParam && roleParam) {
        setInvitationToken(invitationParam);
        setInvitationVenueId(venueParam);
        setInvitationRole(roleParam);
        setFormData((prev) => ({ ...prev, email: emailParam }));
        setStep("form"); // Skip tier selection for invited users
        setSelectedTier("skip"); // Mark as invitation signup
      } else {
        // Regular signup - check for pre-filled email from OAuth
        const pendingEmail = sessionStorage.getItem("pending_signup_email");
        if (pendingEmail) {
          setFormData((prev) => ({ ...prev, email: pendingEmail }));
        } else if (emailParam) {
          setFormData((prev) => ({ ...prev, email: emailParam }));
        }
      }
    }
  }, []);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // For invitation signups, only validate name, email, and password
    if (invitationToken) {
      // Basic validation for invitation signup
      if (!formData.fullName.trim()) {
        setError("Full name is required.");
        setLoading(false);
        return;
      }
      if (!formData.password.trim()) {
        setError("Password is required.");
        setLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters long.");
        setLoading(false);
        return;
      }

      // Accept invitation (creates account and assigns role)
      try {
        const response = await fetch(`/api/staff/invitations/${invitationToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: formData.fullName.trim(),
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to accept invitation");
        }

        // Sign in with the new credentials
        const supabase = supabaseBrowser();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) {
          throw new Error("Account created but failed to sign in. Please try signing in manually.");
        }

        // Redirect to the venue dashboard
        router.push(`/dashboard/${invitationVenueId}`);
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept invitation");
        setLoading(false);
        return;
      }
    }

    // Regular signup validation (requires venue name)
    if (!formData.fullName.trim()) {
      setError("Full name is required.");
      setLoading(false);
      return;
    }
    if (!formData.email.trim()) {
      setError("Email address is required.");
      setLoading(false);
      return;
    }
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (!formData.password.trim()) {
      setError("Password is required.");
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }
    if (!formData.venueName.trim()) {
      setError("Business name is required.");
      setLoading(false);
      return;
    }
    if (!selectedTier) {
      setError("Please select a pricing tier.");
      setLoading(false);
      return;
    }

    try {
      // Store form data temporarily for after Stripe checkout
      localStorage.setItem(
        "signup_data",
        JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          venueName: formData.venueName,
          venueType: formData.businessType,
          serviceType: formData.serviceType,
          tier: selectedTier,
        })
      );

      // Create Stripe checkout session FIRST
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: selectedTier,
          email: formData.email,
          fullName: formData.fullName,
          venueName: formData.venueName,
          isSignup: true,
        }),
      });

      const data = await response.json();

      if (data.error || !data.url) {
        setError(data.error || "Failed to create checkout session. Please try again.");
        localStorage.removeItem("signup_data");
        setLoading(false);
        return;
      }

      // Redirect to Stripe checkout FIRST
      window.location.href = data.url;
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Sign-up failed. Please try again.");
      localStorage.removeItem("signup_data");
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);

    try {
      await onGoogleSignIn();
      // The redirect will happen automatically
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Google sign-up failed. Please try again.");
      setLoading(false);
    }
  };

  // Tier selection data
  const tiers = [
    {
      name: "Basic",
      id: "starter",
      price: "£99",
      description: "Perfect for small cafes",
      features: ["10 tables", "50 menu items", "QR ordering", "Basic analytics"],
    },
    {
      name: "Standard",
      id: "pro",
      price: "£249",
      description: "Most popular for growing businesses",
      popular: true,
      features: ["20 tables", "200 menu items", "KDS", "Inventory", "Advanced analytics"],
    },
    {
      name: "Premium",
      id: "enterprise",
      price: "£449+",
      description: "Unlimited for enterprises",
      contact: true,
      features: ["Unlimited tables", "Unlimited items", "AI Assistant", "Multi-venue"],
    },
  ];

  // Render tier selection step
  if (step === "tier") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-6xl animate-in fade-in duration-300">
          <CardHeader className="text-center">
            <NavigationBreadcrumb showBackButton={false} />
            <CardTitle className="text-3xl font-bold">Choose Your Plan</CardTitle>
            <CardDescription>
              Start your 14-day free trial • First billing after trial ends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 max-w-5xl mx-auto">
              {tiers.map((tier) => (
                <Card
                  key={tier.id}
                  className={`relative cursor-pointer transition-all hover:shadow-lg ${
                    selectedTier === tier.id ? "border-2 border-purple-500 shadow-lg" : ""
                  } ${tier.popular ? "border-2 border-purple-400" : ""}`}
                  onClick={() => {
                    if (tier.contact) {
                      window.location.href = "mailto:sales@servio.app?subject=Premium Plan Inquiry";
                    } else {
                      setSelectedTier(tier.id);
                    }
                  }}
                >
                  {tier.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500">
                      Most Popular
                    </Badge>
                  )}
                  <CardContent className="p-6 text-center">
                    <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                    <div className="text-3xl font-bold mb-2">
                      {tier.price}
                      <span className="text-sm font-normal text-gray-600">/month</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{tier.description}</p>
                    <ul className="space-y-2 text-left mb-4">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {tier.contact ? (
                      <div className="text-sm text-purple-600 font-medium flex items-center justify-center gap-1">
                        <Mail className="h-4 w-4" />
                        Contact Sales
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        {selectedTier === tier.id && "✓ Selected"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center">
              <Link href="/sign-in" className="text-sm text-purple-600 hover:underline">
                Already have an account?
              </Link>
              <Button
                onClick={async () => {
                  if (!selectedTier) {
                    setError("Please select a plan to continue");
                    return;
                  }
                  setError(null);
                  setLoading(true);

                  try {
                    // Redirect directly to Stripe checkout
                    const response = await fetch("/api/stripe/create-checkout-session", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        tier: selectedTier,
                        isSignup: true,
                      }),
                    });

                    const data = await response.json();

                    if (data.error || !data.url) {
                      setError(
                        data.error || "Failed to create checkout session. Please try again."
                      );
                      setLoading(false);
                      return;
                    }

                    // Redirect to Stripe checkout
                    window.location.href = data.url;
                  } catch (_err) {
                    setError(
                      _err instanceof Error
                        ? _err.message
                        : "Failed to create checkout session. Please try again."
                    );
                    setLoading(false);
                  }
                }}
                disabled={!selectedTier || loading}
                size="lg"
                variant="servio"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  `Continue with ${selectedTier ? tiers.find((t) => t.id === selectedTier)?.name : "Selected Plan"}`
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-gray-500 mt-4">
              ✨ 14-day free trial • No credit card required upfront • Cancel anytime
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render account details form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-in fade-in duration-300">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {invitationToken ? "Accept Invitation" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {invitationToken
              ? `Create your account to join as a ${invitationRole}`
              : `Sign up for ${tiers.find((t) => t.id === selectedTier)?.name} plan • 14-day free trial`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error.includes("already have an account") ? (
                  <>
                    You already have an account with this email. Please{" "}
                    <Link href="/sign-in" className="underline hover:no-underline font-medium">
                      sign in
                    </Link>{" "}
                    instead.
                  </>
                ) : (
                  error
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Google Sign Up Button - Hide for invitation signups */}
          {!invitationToken && (
            <Button
              onClick={handleGoogleSignUp}
              disabled={loading || isSigningUp}
              className="w-full bg-white border border-gray-300 text-white hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <g>
                  <path
                    fill="#4285F4"
                    d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"
                  />
                  <path
                    fill="#34A853"
                    d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.19-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </g>
              </svg>
              {loading || isSigningUp ? "Creating account..." : "Sign up with Google"}
            </Button>
          )}

          {!invitationToken && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-white">Or continue with email</span>
              </div>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                disabled={loading || !!invitationToken}
                readOnly={!!invitationToken}
                required
              />
              {invitationToken && (
                <p className="text-xs text-purple-600 font-medium">
                  This email is from your invitation and cannot be changed
                </p>
              )}
              {!invitationToken && formData.email && (
                <p className="text-xs text-gray-500">
                  {typeof window !== "undefined" && sessionStorage.getItem("pending_signup_email")
                    ? "Pre-filled from your Google account • You can change this if needed"
                    : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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

            {/* Hide venue name for invitation signups */}
            {!invitationToken && (
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
            )}

            {/* Hide business details for invitation signups */}
            {!invitationToken && (
              <>
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
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {invitationToken ? "Creating account..." : "Redirecting to payment..."}
                </>
              ) : invitationToken ? (
                "Create Account & Join Team"
              ) : (
                "Continue to Payment & Start Trial"
              )}
            </Button>
          </form>

          <div className="flex justify-between items-center text-sm">
            {/* Hide "Change Plan" button for invitation signups */}
            {!invitationToken && (
              <Button variant="ghost" size="sm" onClick={() => setStep("tier")} disabled={loading}>
                ← Change Plan
              </Button>
            )}
            <Link
              href="/sign-in"
              className={`text-purple-600 hover:underline ${invitationToken ? "w-full text-center" : ""}`}
            >
              Sign in
            </Link>
          </div>

          {/* Hide payment message for invitation signups */}
          {!invitationToken && (
            <p className="text-xs text-center text-gray-500">
              You'll enter payment details first. Your card won't be charged for 14 days. Your
              account will be created after payment setup.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
