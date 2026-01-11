import { useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { detectColorsFromImage } from "../utils/colorDetection";
import { DesignSettings } from "../types";

export function useLogoUpload(

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const { toast } = useToast();

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({

        description: "Please upload an image file (PNG, JPG, etc.)",

      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({

      return;
    }

    try {
      setIsUploadingLogo(true);
      const supabase = createClient();

      try {
        await supabase.storage.createBucket("venue-assets", {

          allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"],

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

      };

      setDesignSettings(updatedSettings);

      try {
        await supabase.from("menu_design_settings").upsert({

          ...updatedSettings,

      } catch (dbError) {
        // Error silently handled
      }

      toast({

    } catch (_error) {
      toast({

    } finally {
      setIsUploadingLogo(false);
    }
  };

  return {
    isUploadingLogo,
    handleLogoUpload,
  };
}
