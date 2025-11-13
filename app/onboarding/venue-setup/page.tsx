"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle, ArrowRight, Building2, CreditCard } from "lucide-react";
import OnboardingProgress from "@/components/onboarding-progress";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export default function OnboardingVenueSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        router.push("/sign-in");
        return;
      }

      // Check if user has pending signup data (new flow)
      const pendingSignup = user.user_metadata?.pending_signup;

      // Get venue (if already created)
      const { data: venues } = await supabase
        .from("venues")
        .select("venue_id, venue_name, organization_id")
        .eq("owner_user_id", user.id)
        .limit(1);

      if (venues && venues.length > 0) {
        // Venue already exists - use it
        const venue = venues[0];
        setVenueId(venue.venue_id);
        setVenueName(venue.venue_name || "");

        // Get organization subscription info
        if (venue.organization_id) {
          const { data: org } = await supabase
            .from("organizations")
            .select("subscription_tier, subscription_status, stripe_customer_id")
            .eq("id", venue.organization_id)
            .single();

          if (org) {
            setSubscriptionTier(org.subscription_tier || "starter");
            setPaymentConfirmed(
              !!org.stripe_customer_id ||
                org.subscription_status === "trialing" ||
                org.subscription_status === "active"
            );
          }
        }

        // Check if logo exists
        const { data: designSettings } = await supabase
          .from("menu_design_settings")
          .select("logo_url")
          .eq("venue_id", venue.venue_id)
          .single();

        if (designSettings?.logo_url) {
          setLogoUrl(designSettings.logo_url);
        }
      } else if (pendingSignup) {
        // No venue yet, but have pending signup data - use it
        setVenueName(pendingSignup.venueName || "");
        setSubscriptionTier(pendingSignup.tier || "starter");
        setPaymentConfirmed(!!pendingSignup.stripeCustomerId || !!pendingSignup.stripeSessionId);
      } else {
        // No venue and no pending signup - redirect to plan selection
        router.push("/select-plan");
        return;
      }

      setLoading(false);
    } catch (_error) {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploadingLogo(true);

    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        toast({
          title: "Error",
          description: "Please sign in to upload logo",
          variant: "destructive",
        });
        setUploadingLogo(false);
        return;
      }

      // Ensure venue exists before uploading logo
      let currentVenueId = venueId;
      if (!currentVenueId) {
        // Create organization/venue first
        const response = await fetch("/api/signup/complete-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.venueId) {
          throw new Error(data.error || "Failed to create venue");
        }

        currentVenueId = data.venueId;
        setVenueId(currentVenueId);
      }

      // Ensure bucket exists
      try {
        await supabase.storage.createBucket("venue-assets", {
          public: true,
          allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"],
          fileSizeLimit: 2097152,
        });
      } catch (bucketError: unknown) {
        if (!(bucketError as Error).message?.includes("already exists")) {
          // Bucket creation failed but not because it exists
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${currentVenueId}/logo-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("venue-assets")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("venue-assets").getPublicUrl(fileName);
      setLogoUrl(urlData.publicUrl);

      // Save to menu_design_settings
      await supabase.from("menu_design_settings").upsert({
        venue_id: currentVenueId,
        logo_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      });

      toast({
        title: "Logo uploaded!",
        description: "Your logo has been saved successfully.",
      });
    } catch (_error) {
      toast({
        title: "Upload failed",
        description:
          _error instanceof Error ? _error.message : "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleContinue = async () => {
    setSaving(true);

    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/sign-in");
        return;
      }

      // If venue doesn't exist yet, create organization and venue first
      if (!venueId) {
        const response = await fetch("/api/signup/complete-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to complete setup");
        }

        // Update venue name if changed
        if (venueName.trim() && data.venueId) {
          await supabase
            .from("venues")
            .update({ venue_name: venueName.trim() })
            .eq("venue_id", data.venueId);
        }

        setVenueId(data.venueId);
      } else {
        // Venue exists, just update name if changed
        if (venueName.trim()) {
          await supabase
            .from("venues")
            .update({ venue_name: venueName.trim() })
            .eq("venue_id", venueId);
        }
      }

      // Store progress
      localStorage.setItem("onboarding_step", "1");
      localStorage.setItem("onboarding_venue_setup_complete", "true");

      toast({
        title: "Setup complete!",
        description: "Moving to menu setup...",
      });

      // Move to next step
      router.push("/onboarding/menu");
    } catch (_error) {
      toast({
        title: "Failed to save",
        description: _error instanceof Error ? _error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case "starter":
        return "Starter Plan";
      case "pro":
        return "Pro Plan";
      case "enterprise":
        return "Enterprise Plan";
      default:
        return "Your Plan";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <OnboardingProgress currentStep={1} />

      <Card className="border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Building2 className="w-6 h-6 mr-2 text-purple-600" />
            Welcome! Let&apos;s set up your venue
          </CardTitle>
          <CardDescription className="text-base">
            Complete your venue details and upload your logo to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Confirmation */}
          {paymentConfirmed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Payment Confirmed</p>
                  <p className="text-sm text-green-700">
                    {subscriptionTier &&
                      `You're on the ${getTierDisplayName(subscriptionTier)} with a 14-day free trial.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Venue Name */}
          <div className="space-y-2">
            <Label htmlFor="venueName">Venue Name</Label>
            <Input
              id="venueName"
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Enter your venue name"
              disabled={saving}
            />
            <p className="text-xs text-gray-500">
              This will be displayed to customers when they scan QR codes.
            </p>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Venue Logo (Optional)</Label>
            <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 bg-purple-50 hover:bg-purple-100 transition-colors">
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploadingLogo}
              />
              <label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center">
                {logoUrl ? (
                  <>
                    <img
                      src={logoUrl}
                      alt="Venue logo"
                      className="w-24 h-24 object-contain mb-3 rounded"
                    />
                    <span className="text-sm text-gray-600">Click to change logo</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-purple-600 mb-3" />
                    <span className="text-lg font-medium text-gray-900">
                      {uploadingLogo ? "Uploading..." : "Click to upload logo"}
                    </span>
                    <span className="text-sm text-gray-600 mt-1">PNG, JPG, or GIF • Max 2MB</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Continue Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleContinue}
              disabled={saving || !venueName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  Continue to Menu Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
