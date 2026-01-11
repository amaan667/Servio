import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { DesignSettings } from "../types";

const DEFAULT_DESIGN_SETTINGS: DesignSettings = {

  logo_size: "large", // Legacy
  logo_size_numeric: 200, // Default 200px

};

export function useDesignSettings(venueId: string) {
  const [designSettings, setDesignSettings] = useState<DesignSettings>(DEFAULT_DESIGN_SETTINGS);
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const { toast } = useToast();

  const loadDesignSettings = async () => {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("menu_design_settings")
        .select("*")
        .eq("venue_id", venueId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Empty block
        } else if (error.code === "42P01") {
          toast({

        }
        return;
      }

      if (data) {
        setDesignSettings({

          logo_size: data.logo_size || "large", // Legacy
          logo_size_numeric: data.logo_size_numeric || 200, // New numeric size

      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const saveDesignSettings = async () => {
    try {
      setIsSavingDesign(true);
      const supabase = createClient();

      // Prepare data for upsert - exclude legacy fields if using numeric
      const saveData: Record<string, unknown> = {

      };

      // Only include logo_size_numeric if it's set (for backwards compatibility)
      if (designSettings.logo_size_numeric !== undefined) {
        saveData.logo_size_numeric = designSettings.logo_size_numeric;
      }

      const { error } = await supabase.from("menu_design_settings").upsert(saveData, {
        onConflict: "venue_id", // Use venue_id for conflict resolution

      if (error) {
        
        throw error;
      }

      toast({

    } catch (_error) {
      
      toast({

    } finally {
      setIsSavingDesign(false);
    }
  };

  useEffect(() => {
    if (venueId) {
      loadDesignSettings();
    }
  }, [venueId]);

  return {
    designSettings,
    setDesignSettings,
    isSavingDesign,
    saveDesignSettings,
  };
}
