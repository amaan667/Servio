"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from '@/lib/supabase';
import { logger } from "@/lib/logger";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

interface CompleteProfileFormProps {
  user: any;
}

export default function CompleteProfileForm({ user }: CompleteProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    venueName: "",
    businessType: "Restaurant",
    address: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) {
        setError("No user found. Please sign in again.");
        return;
      }

      const venueId = `venue-${user.id.slice(0, 8)}`;
      
      console.log("[COMPLETE-PROFILE] Creating/updating venue for user:", user.id);
      
      // First check if venue already exists
      const { data: existingVenue, error: checkError } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (existingVenue) {
        console.log("[COMPLETE-PROFILE] Updating existing venue:", existingVenue.venue_id);
        // Update existing venue
        const { data: updatedVenue, error: updateError } = await supabase
          .from("venues")
          .update({
            name: formData.venueName,
            business_type: formData.businessType,
            address: formData.address || null,
            phone: formData.phone || null,
          })
          .eq("owner_id", user.id)
          .select()
          .single();

        if (updateError) {
          console.error("[COMPLETE-PROFILE] Update venue error:", updateError);
          throw updateError;
        }

        // Update user metadata to mark profile as complete
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { profileComplete: true }
        });
        
        if (metadataError) {
          console.error("[COMPLETE-PROFILE] Error updating user metadata:", metadataError);
        }
        
        logger.info("Profile updated successfully", { userId: user.id, venueId: existingVenue.venue_id });
        router.replace(`/dashboard/${existingVenue.venue_id}`);
        return;
      }

      console.log("[COMPLETE-PROFILE] Creating new venue:", venueId);
      // Create new venue
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .insert({
          venue_id: venueId,
          name: formData.venueName,
          business_type: formData.businessType,
          address: formData.address || null,
          phone: formData.phone || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (venueError) {
        console.error("[COMPLETE-PROFILE] Create venue error:", venueError);
        if (venueError.code === "23505") {
          // Unique constraint violation - venue already exists
          console.log("[COMPLETE-PROFILE] Venue already exists, updating instead");
          const { data: existingVenue, error: fetchError } = await supabase
            .from("venues")
            .select("*")
            .eq("owner_id", user.id)
            .single();

          if (fetchError) {
            console.error("[COMPLETE-PROFILE] Fetch existing venue error:", fetchError);
            throw fetchError;
          }

          // Update the existing venue
          const { data: updatedVenue, error: updateError } = await supabase
            .from("venues")
            .update({
              name: formData.venueName,
              business_type: formData.businessType,
              address: formData.address || null,
              phone: formData.phone || null,
            })
            .eq("owner_id", user.id)
            .select()
            .single();

          if (updateError) {
            console.error("[COMPLETE-PROFILE] Update existing venue error:", updateError);
            throw updateError;
          }

          // Update user metadata to mark profile as complete
          const { error: metadataError } = await supabase.auth.updateUser({
            data: { profileComplete: true }
          });
          
          if (metadataError) {
            console.error("[COMPLETE-PROFILE] Error updating user metadata:", metadataError);
          }
          
          logger.info("Profile completed successfully", { userId: user.id, venueId: existingVenue.venue_id });
          router.replace(`/dashboard/${existingVenue.venue_id}`);
        } else {
          throw venueError;
        }
      } else {
        // Update user metadata to mark profile as complete
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { profileComplete: true }
        });
        
        if (metadataError) {
          console.error("[COMPLETE-PROFILE] Error updating user metadata:", metadataError);
        }
        
        logger.info("Profile completed successfully", { userId: user.id, venueId });
        router.replace(`/dashboard/${venueId}`);
      }
    } catch (error: any) {
      console.error("[COMPLETE-PROFILE] Failed to complete profile:", error);
      logger.error("Failed to complete profile", { error });
      setError(error.message || "Failed to complete profile setup");
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
                <Label htmlFor="venueName">Business Name</Label>
                <Input
                  id="venueName"
                  type="text"
                  value={formData.venueName}
                  onChange={(e) =>
                    setFormData({ ...formData, venueName: e.target.value })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, businessType: e.target.value })
                  }
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="Restaurant">Restaurant</option>
                  <option value="Cafe">Cafe</option>
                  <option value="Food Truck">Food Truck</option>
                  <option value="Coffee Shop">Coffee Shop</option>
                  <option value="Bar">Bar</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address (Optional)</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Enter your business address"
                  disabled={loading}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Enter your phone number"
                  disabled={loading}
                />
              </div>

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
