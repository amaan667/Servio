"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CompleteProfile() {
  const [businessType, setBusinessType] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!supabase) {
      setError("Database connection not available.");
      setLoading(false);
      return;
    }

    const { data: { user }, error: userError } = await createClient().auth.getUser();
    if (!user || userError) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    try {
      // Create venue with correct schema fields
      const venueId = `${businessName.toLowerCase().replace(/\s+/g, '-')}-${user.id.substring(0, 8)}`;
      
      const { error: upsertError } = await createClient().from("venues").upsert({
        venue_id: venueId,
        name: businessName,
        business_type: businessType.toLowerCase(),
        owner_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (upsertError) {
        console.error("Venue creation error:", upsertError);
        setError("Failed to save profile. Please try again.");
        setLoading(false);
        return;
      }

      // Fetch the venue just created
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select("*")
        .eq("venue_id", venueId)
        .single();

      if (!venue || venueError) {
        console.error("Venue fetch error:", venueError);
        setError("Failed to fetch venue after creation. Please try again.");
        setLoading(false);
        return;
      }

      console.log("Profile completed successfully:", venue);
      setLoading(false);
      router.push("/dashboard");

    } catch (err) {
      console.error("Profile completion error:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Complete Your Profile</h2>
          <p className="mt-2 text-sm text-gray-600">
            Set up your business details to get started
          </p>
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
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter your business name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type *</Label>
                <Select value={businessType} onValueChange={setBusinessType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Restaurant">Restaurant</SelectItem>
                    <SelectItem value="Cafe">Cafe</SelectItem>
                    <SelectItem value="Food Truck">Food Truck</SelectItem>
                    <SelectItem value="Coffee Shop">Coffee Shop</SelectItem>
                    <SelectItem value="Bar">Bar</SelectItem>
                    <SelectItem value="Bakery">Bakery</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Completing Setup..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 