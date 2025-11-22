"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image, Upload } from "lucide-react";
import { DesignSettings } from "../types";
import { checkFeatureAccess, getUserTier } from "@/lib/tier-restrictions";
import { TierRestrictionBanner } from "@/components/TierRestrictionBanner";
import { useAuth } from "@/app/auth/AuthProvider";

interface BrandingSettingsProps {
  designSettings: DesignSettings;
  setDesignSettings: (settings: DesignSettings) => void;
  onLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingLogo: boolean;
  venueId: string;
}

export function BrandingSettings({
  designSettings,
  setDesignSettings,
  onLogoUpload,
  isUploadingLogo,
  venueId,
}: BrandingSettingsProps) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(true);
  const [currentTier, setCurrentTier] = useState("starter");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkTier = async () => {
      if (!user?.id) {
        setChecking(false);
        return;
      }

      const tier = await getUserTier(user.id);
      setCurrentTier(tier);
      const access = await checkFeatureAccess(user.id, "customBranding");
      setHasAccess(access.allowed);
      setChecking(false);
    };

    checkTier();
  }, [user]);

  if (checking) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Image className="h-5 w-5" />
            <span>Branding</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Checking access...</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Image className="h-5 w-5" />
            <span>Branding</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TierRestrictionBanner
            currentTier={currentTier}
            requiredTier="enterprise"
            featureName="Custom Branding"
            venueId={venueId}
            reason="Custom branding (logo upload, colors, fonts) requires Enterprise tier"
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Image className="h-5 w-5" />
          <span>Branding</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="venue-name">Venue Name</Label>
          <Input
            id="venue-name"
            value={designSettings.venue_name}
            onChange={(e) => setDesignSettings({ ...designSettings, venue_name: e.target.value })}
            placeholder="Your Restaurant Name"
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="custom-heading">Custom Heading/Text</Label>
          <Input
            id="custom-heading"
            value={designSettings.custom_heading || ""}
            onChange={(e) =>
              setDesignSettings({ ...designSettings, custom_heading: e.target.value })
            }
            placeholder="Enter custom heading or text to display"
            className="mt-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            This text will appear below the logo in your menu preview
          </p>
        </div>
        <div>
          <Label htmlFor="logo-upload">Logo Upload</Label>
          <div className="mt-2">
            {designSettings.logo_url && (
              <div className="mb-4">
                <img
                  src={designSettings.logo_url}
                  alt="Current logo"
                  className="h-16 w-auto object-contain border border-gray-200 rounded"
                />
              </div>
            )}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                onChange={onLogoUpload}
                className="hidden"
                disabled={isUploadingLogo}
              />
              <label htmlFor="logo-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {isUploadingLogo ? "Uploading..." : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-gray-500">PNG, JPG up to 2MB</p>
              </label>
            </div>
          </div>
        </div>

        {designSettings.logo_url && (
          <div>
            <Label htmlFor="logo-size">Logo Size (px)</Label>
            <div className="mt-2 space-y-2">
              <input
                type="range"
                id="logo-size"
                min="80"
                max="400"
                step="20"
                value={designSettings.logo_size_numeric || 200}
                onChange={(e) =>
                  setDesignSettings({
                    ...designSettings,
                    logo_size_numeric: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>80px</span>
                <span className="font-semibold text-purple-600">
                  {designSettings.logo_size_numeric || 200}px
                </span>
                <span>400px</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
