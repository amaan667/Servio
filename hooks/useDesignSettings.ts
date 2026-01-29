/**
 * Custom Hook: useDesignSettings
 * Extracted from MenuManagementClient.tsx
 * Manages menu design settings
 */

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface DesignSettings {
  venue_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  font_size: string;
  font_size_numeric?: number;
  logo_size?: string;
  custom_heading?: string;
  auto_theme_enabled?: boolean;
  detected_primary_color?: string;
  detected_secondary_color?: string;
  show_descriptions: boolean;
  show_prices: boolean;
}

const defaultSettings: DesignSettings = {
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
  const [settings, setSettings] = useState<DesignSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("venues")
        .select(
          "venue_name, logo_url, primary_color, secondary_color, font_family, font_size, font_size_numeric, logo_size, custom_heading, auto_theme_enabled, detected_primary_color, detected_secondary_color, show_descriptions, show_prices"
        )
        .eq("venue_id", venueId)
        .single();

      if (fetchError) throw fetchError;

      setSettings({
        ...defaultSettings,
        ...data,
      });
    } catch (_err) {
      setError("Failed to load design settings");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    if (venueId) {
      fetchSettings();
    }
  }, [venueId, fetchSettings]);

  const saveSettings = useCallback(
    async (updates: Partial<DesignSettings>) => {
      try {
        setSaving(true);
        setError(null);

        const supabase = createClient();
        const { error: updateError } = await supabase
          .from("venues")
          .update(updates)
          .eq("venue_id", venueId);

        if (updateError) throw updateError;

        setSettings((prev) => ({ ...prev, ...updates }));
        return { success: true };
      } catch (_err) {
        setError("Failed to save design settings");
        return { success: false, error: _err };
      } finally {
        setSaving(false);
      }
    },
    [venueId]
  );

  const updateColor = useCallback(
    async (type: "primary" | "secondary", color: string) => {
      return saveSettings({ [`${type}_color`]: color });
    },
    [saveSettings]
  );

  const updateFont = useCallback(
    async (family: string, size: string, sizeNumeric?: number) => {
      return saveSettings({
        font_family: family,
        font_size: size,
        font_size_numeric: sizeNumeric,
      });
    },
    [saveSettings]
  );

  const updateLogo = useCallback(
    async (logoUrl: string) => {
      return saveSettings({ logo_url: logoUrl });
    },
    [saveSettings]
  );

  const toggleFeature = useCallback(
    async (feature: "show_descriptions" | "show_prices" | "auto_theme_enabled", value: boolean) => {
      return saveSettings({ [feature]: value });
    },
    [saveSettings]
  );

  return {
    settings,
    loading,
    saving,
    error,
    fetchSettings,
    saveSettings,
    updateColor,
    updateFont,
    updateLogo,
    toggleFeature,
  };
}
