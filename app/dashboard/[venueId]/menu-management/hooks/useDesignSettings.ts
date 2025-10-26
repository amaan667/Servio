import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
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
  logo_size: "large",
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
          logo_size: data.logo_size || "large",
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

      const { error } = await supabase.from("menu_design_settings").upsert({
        venue_id: venueId,
        ...designSettings,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Design saved successfully",
        description: "Your design settings have been saved.",
      });
    } catch (_error) {
      toast({
        title: "Save failed",
        description: _error.message || "Failed to save design settings.",
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
