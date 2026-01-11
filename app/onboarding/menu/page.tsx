"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Plus, ArrowRight, Sparkles } from "lucide-react";
import OnboardingProgress from "@/components/onboarding-progress";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export default function OnboardingMenuPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [manualItems, setManualItems] = useState<
    { name: string; price: string; category: string }[]
  >([{ name: "", price: "", category: "Drinks" }]);

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
        setLoading(false);
        return;
      }

      // Get venue
      const { data: venues } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", user.id)
        .limit(1);

      if (!venues || venues.length === 0) {
        // Check if user has pending signup data - ensure venue is created
        const pendingSignup = user.user_metadata?.pending_signup;
        if (pendingSignup) {
          // Ensure venue is created
          const response = await fetch("/api/signup/complete-onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          const data = await response.json();
          if (response.ok && data.success && data.venueId) {
            setVenueId(data.venueId);
            setLoading(false);
            return;
          }
        }
        // No venue and no pending signup - redirect to venue setup
        router.push("/onboarding/venue-setup");
        setLoading(false);
        return;
      }

      setVenueId(venues[0]?.venue_id);
      setLoading(false);
    } catch (_error) {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !venueId) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("venueId", venueId);

      const response = await fetch("/api/menu/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      // Store progress (both local and server-side)
      localStorage.setItem("onboarding_step", "2");
      localStorage.setItem("onboarding_menu_complete", "true");
      await import("@/lib/onboarding-progress").then(({ saveOnboardingProgress }) =>
        saveOnboardingProgress(2, [1, 2], { menu_complete: true })
      );

      toast({
        title: "Menu uploaded!",
        description: `Successfully extracted ${result.itemsCount || 0} items from your menu.`,
      });

      // Move to next step
      router.push("/onboarding/tables");
    } catch (_error) {
      toast({
        title: "Upload failed",
        description:
          _error instanceof Error ? _error.message : "Failed to upload menu. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleManualCreate = async () => {
    if (!venueId) return;

    // Validate at least one item
    const validItems = manualItems.filter((item) => item.name.trim() && item.price.trim());
    if (validItems.length === 0) {
      toast({
        title: "No items to add",
        description: "Please add at least one menu item.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const supabase = await createClient();

      // Insert items
      const itemsToInsert = validItems.map((item) => ({
        venue_id: venueId,
        name: item.name.trim(),
        price: parseFloat(item.price),
        category: item.category,
        description: "",
        is_available: true,
        image_url: null,
      }));

      const { error } = await supabase.from("menu_items").insert(itemsToInsert);

      if (error) throw error;

      // Store progress
      localStorage.setItem("onboarding_step", "1");
      localStorage.setItem("onboarding_menu_complete", "true");

      toast({
        title: "Menu items created!",
        description: `Added ${validItems.length} items to your menu.`,
      });

      // Move to next step
      router.push("/onboarding/tables");
    } catch (_error) {
      toast({
        title: "Failed to create items",
        description: _error instanceof Error ? _error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const addManualItem = () => {
    setManualItems([...manualItems, { name: "", price: "", category: "Drinks" }]);
  };

  const updateManualItem = (index: number, field: string, value: string) => {
    const updated = [...manualItems];
    updated[index] = { ...updated[index], [field]: value };
    setManualItems(updated);
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_step", "1");
    router.push("/onboarding/tables");
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
      <OnboardingProgress currentStep={2} />

      <Card className="border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Sparkles className="w-6 h-6 mr-2 text-purple-600" />
            Let's start with your menu
          </CardTitle>
          <CardDescription className="text-base">
            Upload a PDF/image of your menu, or create items manually. Servio will automatically
            recognize categories and prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Option */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Option 1: Upload Menu (Recommended)</h3>
            <div className="border-2 border-dashed border-purple-300 rounded-lg p-8 bg-purple-50 hover:bg-purple-100 transition-colors">
              <input
                type="file"
                id="menu-upload"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <label htmlFor="menu-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-12 h-12 text-purple-600 mb-3" />
                <span className="text-lg font-medium text-gray-900">
                  {uploading ? "Uploading..." : "Click to upload menu"}
                </span>
                <span className="text-sm text-gray-600 mt-1">
                  PDF, JPG, or PNG • AI will extract items automatically
                </span>
              </label>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">OR</span>
            </div>
          </div>

          {/* Manual Option */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Option 2: Create Manually</h3>
            <div className="space-y-3">
              {manualItems.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <Label htmlFor={`item-name-${index}`}>Item Name</Label>
                    <Input
                      id={`item-name-${index}`}
                      value={item.name}
                      onChange={(e) => updateManualItem(index, "name", e.target.value)}
                      placeholder="e.g. Cappuccino"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`item-price-${index}`}>Price (£)</Label>
                    <Input
                      id={`item-price-${index}`}
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateManualItem(index, "price", e.target.value)}
                      placeholder="4.50"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`item-category-${index}`}>Category</Label>
                    <select
                      id={`item-category-${index}`}
                      value={item.category}
                      onChange={(e) => updateManualItem(index, "category", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                      disabled={uploading}
                    >
                      <option value="Drinks">Drinks</option>
                      <option value="Food">Food</option>
                      <option value="Coffee">Coffee</option>
                      <option value="Brunch">Brunch</option>
                      <option value="Desserts">Desserts</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addManualItem}
                disabled={uploading}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Item
              </Button>

              <Button
                onClick={handleManualCreate}
                disabled={uploading}
                variant="servio"
                className="w-full"
              >
                {uploading ? "Creating..." : "Create Menu Items"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Skip Button */}
          <div className="pt-4 border-t">
            <Button variant="ghost" onClick={handleSkip} disabled={uploading} className="w-full">
              Skip for Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
