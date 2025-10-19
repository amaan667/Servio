"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";
import { DesignSettings } from "../types";

interface ThemeSettingsProps {
  designSettings: DesignSettings;
  setDesignSettings: (settings: DesignSettings) => void;
}

export function ThemeSettings({ designSettings, setDesignSettings }: ThemeSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Palette className="h-5 w-5" />
          <span>Theme & Colors</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {designSettings.detected_primary_color && designSettings.detected_secondary_color && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="auto-theme" className="text-sm font-medium">Use Auto-Detected Theme</Label>
              <p className="text-xs text-gray-500">Automatically apply colors detected from your logo</p>
            </div>
            <input
              type="checkbox"
              id="auto-theme"
              checked={designSettings.auto_theme_enabled || false}
              onChange={(e) => {
                const autoTheme = e.target.checked;
                setDesignSettings({
                  ...designSettings,
                  auto_theme_enabled: autoTheme,
                  primary_color: autoTheme ? (designSettings.detected_primary_color || designSettings.primary_color) : designSettings.primary_color,
                  secondary_color: autoTheme ? (designSettings.detected_secondary_color || designSettings.secondary_color) : designSettings.secondary_color
                });
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="color"
                id="primary-color"
                value={designSettings.primary_color}
                onChange={(e) => setDesignSettings({ ...designSettings, primary_color: e.target.value, auto_theme_enabled: false })}
                className="w-12 h-10 rounded border border-gray-300"
                disabled={designSettings.auto_theme_enabled}
              />
              <Input 
                value={designSettings.primary_color}
                onChange={(e) => setDesignSettings({ ...designSettings, primary_color: e.target.value, auto_theme_enabled: false })}
                placeholder="#8b5cf6" 
                className="flex-1" 
                disabled={designSettings.auto_theme_enabled}
              />
            </div>
            {designSettings.auto_theme_enabled && designSettings.detected_primary_color && (
              <p className="text-xs text-gray-500 mt-1">Auto-detected: {designSettings.detected_primary_color}</p>
            )}
          </div>
          <div>
            <Label htmlFor="secondary-color">Secondary Color</Label>
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="color"
                id="secondary-color"
                value={designSettings.secondary_color}
                onChange={(e) => setDesignSettings({ ...designSettings, secondary_color: e.target.value, auto_theme_enabled: false })}
                className="w-12 h-10 rounded border border-gray-300"
                disabled={designSettings.auto_theme_enabled}
              />
              <Input 
                value={designSettings.secondary_color}
                onChange={(e) => setDesignSettings({ ...designSettings, secondary_color: e.target.value, auto_theme_enabled: false })}
                placeholder="#f3f4f6" 
                className="flex-1" 
                disabled={designSettings.auto_theme_enabled}
              />
            </div>
            {designSettings.auto_theme_enabled && designSettings.detected_secondary_color && (
              <p className="text-xs text-gray-500 mt-1">Auto-detected: {designSettings.detected_secondary_color}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

