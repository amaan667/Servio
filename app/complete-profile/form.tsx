"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

interface CompleteProfileFormProps {
  user: unknown;
}

export default function CompleteProfileForm({ user }: CompleteProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userMeta = user as {
    user_metadata?: Record<string, unknown>;
    identities?: Array<Record<string, unknown>>;
  } | null;
  const [formData, setFormData] = useState({
    venueName: (userMeta?.user_metadata?.venue_name as string) || "",
    businessType: (userMeta?.user_metadata?.business_type as string) || "Restaurant",
    address: (userMeta?.user_metadata?.address as string) || "",
    phone: (userMeta?.user_metadata?.phone as string) || "",
    password: "",
    confirmPassword: "",
  });

  // Check if user signed up with OAuth (Google) and needs to set a password
  const isOAuthUser = userMeta?.identities?.some(
    (identity: Record<string, unknown>) =>
      identity.provider === "google" || identity.provider === "oauth"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) {
        setError("No user found. Please sign in again.");
        return;
      }

      // Validate all required fields
      if (!formData.venueName.trim()) {
        setError("Business name is required.");
        setLoading(false);
        return;
      }

      if (!formData.address.trim()) {
        setError("Business address is required.");
        setLoading(false);
        return;
      }

      if (!formData.phone.trim()) {
        setError("Phone number is required.");
        setLoading(false);
        return;
      }

      // Validate password for OAuth users (now required)
      if (isOAuthUser) {
        if (!formData.password.trim()) {
          setError("Password is required for Google sign-up users.");
          setLoading(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          setError("Password must be at least 6 characters long.");
          setLoading(false);
          return;
        }
      }

      // Set password for OAuth users (now required)
      if (isOAuthUser) {
        const supabase = await createClient();
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.password,
        });
        if (passwordError) {
          setError(`Failed to set password: ${passwordError.message}`);
          setLoading(false);
          return;
        }
      }

      // Ensure we have a valid venue name (don't autofill from user name)
      const venueName = formData.venueName.trim();
      if (!venueName) {
        setError("Business name is required.");
        setLoading(false);
        return;
      }

      // Generate venue ID based on user ID
      const userMeta = user as {
        id?: string;
      } | null;
      const venueId = `venue-${(userMeta?.id || "").slice(0, 8)}`;

      const res = await fetch("/api/venues/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venueId: venueId,
          name: venueName,
          business_type: formData.businessType,
          address: formData.address || null,
          phone: formData.phone || null,
        }),
      });

      const j = await res.json().catch(() => ({
        /* Empty */
      }));

      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to save venue");
      }

      const returnedVenueId = j.venue?.venue_id || venueId;

      // Update user metadata to mark profile as complete and save additional info
      const supabase2 = await createClient();
      await supabase2.auth.updateUser({
        data: {
          profileComplete: true,
          venue_name: venueName,
          business_type: formData.businessType,
          address: formData.address || null,
          phone: formData.phone || null,
        },
      });

      router.replace(`/dashboard/${returnedVenueId}`);
    } catch (_error) {
      setError((_error as Error).message || "Failed to complete profile setup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md w-full mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <NavigationBreadcrumb showBackButton={false} />

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Complete Your Profile</h2>
          <p className="mt-2 text-sm text-gray-900">Set up your business details to get started</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>
              Tell us about your business to customize your experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                <Label htmlFor="address">Business Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter your business address"
                  disabled={loading}
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter your phone number"
                  disabled={loading}
                  required
                />
              </div>

              {isOAuthUser && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Set Up Password *</h3>
                    <p className="text-sm text-gray-900 mb-4">
                      Create a password for your account so you can sign in with your email and
                      password in the future.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
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
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      placeholder="Confirm your password"
                      disabled={loading}
                      required
                    />
                  </div>
                </>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Setting up..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
