"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Layout } from "lucide-react";
import { DesignSettings } from "../types";

interface LayoutSettingsProps {
  designSettings: DesignSettings;
  setDesignSettings: (settings: DesignSettings) => void;
}

export function LayoutSettings({ designSettings, setDesignSettings }: LayoutSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Layout className="h-5 w-5" />
          <span>Layout & Display</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="font-family">Font Family</Label>
            <select
              id="font-family"
              value={designSettings.font_family}
              onChange={(e) =>
                setDesignSettings({ ...designSettings, font_family: e.target.value })
              }
              className="w-full mt-2 p-2 border border-gray-300 rounded-md"
            >
              <optgroup label="Sans-Serif Fonts">
                <option value="inter">Inter (Default)</option>
                <option value="roboto">Roboto</option>
                <option value="opensans">Open Sans</option>
                <option value="poppins">Poppins</option>
                <option value="lato">Lato</option>
                <option value="montserrat">Montserrat</option>
                <option value="nunito">Nunito</option>
                <option value="source-sans">Source Sans Pro</option>
                <option value="raleway">Raleway</option>
                <option value="ubuntu">Ubuntu</option>
                <option value="fira-sans">Fira Sans</option>
                <option value="work-sans">Work Sans</option>
                <option value="quicksand">Quicksand</option>
                <option value="rubik">Rubik</option>
                <option value="comfortaa">Comfortaa</option>
                <option value="cabin">Cabin</option>
                <option value="dosis">Dosis</option>
                <option value="exo">Exo</option>
                <option value="barlow">Barlow</option>
              </optgroup>
              <optgroup label="Serif Fonts">
                <option value="playfair">Playfair Display</option>
                <option value="merriweather">Merriweather</option>
                <option value="crimson">Crimson Text</option>
                <option value="libre-baskerville">Libre Baskerville</option>
              </optgroup>
              <optgroup label="Display & Script Fonts">
                <option value="dancing-script">Dancing Script</option>
                <option value="pacifico">Pacifico</option>
                <option value="lobster">Lobster</option>
                <option value="bebas-neue">Bebas Neue</option>
                <option value="oswald">Oswald</option>
                <option value="fjalla">Fjalla One</option>
                <option value="anton">Anton</option>
              </optgroup>
            </select>
          </div>
          <div>
            <Label htmlFor="font-size-numeric">Font Size (px)</Label>
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="range"
                id="font-size-numeric"
                min="8"
                max="24"
                value={designSettings.font_size_numeric || 16}
                onChange={(e) =>
                  setDesignSettings({
                    ...designSettings,
                    font_size_numeric: parseInt(e.target.value),
                    font_size:
                      parseInt(e.target.value) <= 12
                        ? "small"
                        : parseInt(e.target.value) <= 18
                          ? "medium"
                          : "large",
                  })
                }
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-center">
                {designSettings.font_size_numeric || 16}px
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>8px</span>
              <span>24px</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <Label htmlFor="show-descriptions" className="text-sm font-medium cursor-pointer">
            Show item descriptions
          </Label>
          <Switch
            id="show-descriptions"
            checked={designSettings.show_descriptions}
            onCheckedChange={(checked) =>
              setDesignSettings({ ...designSettings, show_descriptions: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <Label htmlFor="show-prices" className="text-sm font-medium cursor-pointer">
            Show prices
          </Label>
          <Switch
            id="show-prices"
            checked={designSettings.show_prices}
            onCheckedChange={(checked) =>
              setDesignSettings({ ...designSettings, show_prices: checked })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
