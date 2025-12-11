"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { loadGoogleMapsAPI } from "@/lib/google-maps";

interface AddressInputProps {
  value: string;
  onChange: (value: string, coordinates?: { lat: number; lng: number }) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
}

/**
 * Simple Address Input with Manual Entry and OpenStreetMap Geocoding
 * Users can type addresses manually and get location preview via OpenStreetMap
 */
export function AddressInput({ value, onChange, onCoordinatesChange }: AddressInputProps) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Manual geocoding when address changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value && value.length > 5) {
        handleManualGeocode(value);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [value]);

  // Update map preview when address changes
  const updateMapPreview = async (lat: number, lng: number) => {
    if (lat && lng) {
      // Use OpenStreetMap for map preview (no API key required)
      const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
      setMapUrl(osmUrl);
    }
  };

  // Geocode address when user types manually (without Google autocomplete)
  const handleManualGeocode = async (address: string) => {
    if (!address || address.length < 10) {
      setMapUrl(null);
      return;
    }

    setIsLoadingMap(true);
    try {
      // Use Nominatim (OpenStreetMap) for geocoding (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            "User-Agent": "ServioApp/1.0", // Required by Nominatim
          },
        }
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        updateMapPreview(parseFloat(lat), parseFloat(lon));
        if (onCoordinatesChange) {
          onCoordinatesChange(parseFloat(lat), parseFloat(lon));
        }
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsLoadingMap(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="venueAddress" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Venue Address
          </Label>
          {value && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onChange("");
                setMapUrl(null);
              }}
              className="h-7 px-2 text-xs"
              title="Clear address"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <Input
          ref={inputRef}
          id="venueAddress"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your venue address..."
          className="rounded-lg border-gray-200"
          type="text"
        />
      </div>

      {/* Map Preview */}
      {mapUrl && (
        <Card className="overflow-hidden rounded-lg border-gray-200">
          <div className="relative w-full h-48">
            {isLoadingMap && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
            <iframe
              src={mapUrl}
              className="w-full h-full border-0"
              loading="lazy"
              title="Venue Location Preview"
            />
          </div>
          <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600">
            <MapPin className="h-3 w-3 inline mr-1" />
            Location preview (approximate)
          </div>
        </Card>
      )}
    </div>
  );
}
