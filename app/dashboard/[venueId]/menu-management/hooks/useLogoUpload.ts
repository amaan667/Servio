import { useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { detectColorsFromImage } from "../utils/colorDetection";
import { DesignSettings } from "../types";

export function useLogoUpload(
  venueId: string,
  designSettings: DesignSettings,
  setDesignSettings: (settings: DesignSettings) => void
) {
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const { toast } = useToast();

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingLogo(true);
      const supabase = createClient();

      try {
        await supabase.storage.createBucket("venue-assets", {
          public: true,
          allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"],
          fileSizeLimit: 2097152,
        });
      } catch (bucketError: unknown) {
        if (!(bucketError as Error).message?.includes("already exists")) {
          /* Empty */
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${venueId}/logo-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("venue-assets")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("venue-assets").getPublicUrl(fileName);

      const detectedColors = await detectColorsFromImage(urlData.publicUrl);

      const updatedSettings = {
        ...designSettings,
        logo_url: urlData.publicUrl,
        auto_theme_enabled: true,
        detected_primary_color: detectedColors.primary,
        detected_secondary_color: detectedColors.secondary,
        primary_color: detectedColors.primary,
        secondary_color: detectedColors.secondary,
      };

      setDesignSettings(updatedSettings);

      try {
        await supabase.from("menu_design_settings").upsert({
          venue_id: venueId,
          ...updatedSettings,
          updated_at: new Date().toISOString(),
        });
      } catch (dbError) {
        // Error silently handled
      }

      toast({
        title: "🎉 Logo uploaded successfully!",
        description: "Your logo has been uploaded and a theme has been automatically detected.",
        duration: 5000,
      });
    } catch (_error) {
      toast({
        title: "Upload failed",
        description: _error instanceof Error ? _error.message : "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return {
    isUploadingLogo,
    handleLogoUpload,
  };
}
