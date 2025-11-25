import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { DesignSettings } from "../types";

const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  venue_name: "",
  logo_url: null,
  primary_color: "#8b5cf6",
  secondary_color: "#f3f4f6",
  font_family: "inter",
  font_size: "medium",
  font_size_numeric: 16,
  logo_size: "large", // Legacy
  logo_size_numeric: 200, // Default 200px
  custom_heading: "",
  auto_theme_enabled: false,
  detected_primary_color: "",
  detected_secondary_color: "",
  show_descriptions: true,
  show_prices: true,
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
            title: "Database Setup Required",
            description: "Please run the menu design settings migration script.",
            variant: "destructive",
          });
        }
        return;
      }

      if (data) {
        setDesignSettings({
          venue_name: data.venue_name || "",
          logo_url: data.logo_url,
          primary_color: data.primary_color || "#8b5cf6",
          secondary_color: data.secondary_color || "#f3f4f6",
          font_family: data.font_family || "inter",
          font_size: data.font_size || "medium",
          font_size_numeric: data.font_size_numeric || 16,
          logo_size: data.logo_size || "large", // Legacy
          logo_size_numeric: data.logo_size_numeric || 200, // New numeric size
          custom_heading: data.custom_heading || "",
          auto_theme_enabled: data.auto_theme_enabled ?? false,
          detected_primary_color: data.detected_primary_color || "",
          detected_secondary_color: data.detected_secondary_color || "",
          show_descriptions: data.show_descriptions ?? true,
          show_prices: data.show_prices ?? true,
        });
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
        venue_id: venueId,
        venue_name: designSettings.venue_name,
        logo_url: designSettings.logo_url,
        primary_color: designSettings.primary_color,
        secondary_color: designSettings.secondary_color,
        font_family: designSettings.font_family,
        font_size: designSettings.font_size,
        font_size_numeric: designSettings.font_size_numeric,
        custom_heading: designSettings.custom_heading,
        auto_theme_enabled: designSettings.auto_theme_enabled,
        detected_primary_color: designSettings.detected_primary_color,
        detected_secondary_color: designSettings.detected_secondary_color,
        show_descriptions: designSettings.show_descriptions,
        show_prices: designSettings.show_prices,
        updated_at: new Date().toISOString(),
      };

      // Only include logo_size_numeric if it's set (for backwards compatibility)
      if (designSettings.logo_size_numeric !== undefined) {
        saveData.logo_size_numeric = designSettings.logo_size_numeric;
      }

      const { error } = await supabase.from("menu_design_settings").upsert(saveData, {
        onConflict: "venue_id", // Use venue_id for conflict resolution
      });

      if (error) {
        logger.error("Save design error:", error);
        throw error;
      }

      toast({
        title: "Design saved successfully",
        description: "Your design settings have been saved.",
      });
    } catch (_error) {
      logger.error("Save design catch error:", _error);
      toast({
        title: "Save failed",
        description: _error instanceof Error ? _error.message : "Failed to save design settings.",
        variant: "destructive",
      });
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
