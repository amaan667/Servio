"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { loadGoogleMapsAPI } from "@/lib/google-maps";

interface AddressInputProps {
  value: string;
  onChange: (value: string, coordinates?: { lat: number; lng: number }) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
}

/**
 * Enhanced Address Input with Google Places Autocomplete
 * Falls back to basic input if Google Maps API is not available
 */
export function AddressInput({ value, onChange, onCoordinatesChange }: AddressInputProps) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [hasGoogleMaps, setHasGoogleMaps] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Load Google Maps API
  useEffect(() => {
    loadGoogleMapsAPI()
      .then(() => {
        setHasGoogleMaps(true);
      })
      .catch((error) => {
        console.warn('Google Maps not available:', error.message);
        setHasGoogleMaps(false);
      });
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!hasGoogleMaps || !inputRef.current || autocompleteRef.current) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (place.formatted_address) {
          onChange(place.formatted_address, {
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0,
          });

          if (place.geometry?.location && onCoordinatesChange) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            onCoordinatesChange(lat, lng);
            updateMapPreview(lat, lng);
          }
        }
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error('Error initializing Google Places:', error);
      setHasGoogleMaps(false);
    }
  }, [hasGoogleMaps, onChange, onCoordinatesChange]);

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
            'User-Agent': 'ServioApp/1.0', // Required by Nominatim
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
    } catch (error) {
      console.error('Error geocoding address:', error);
    } finally {
      setIsLoadingMap(false);
    }
  };

  // Debounce manual geocoding
  useEffect(() => {
    if (hasGoogleMaps) return; // Skip if Google Places is handling it
    
    const timer = setTimeout(() => {
      if (value) {
        handleManualGeocode(value);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [value, hasGoogleMaps]);

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="venueAddress" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Venue Address
          {hasGoogleMaps && (
            <span className="text-xs text-green-600 font-normal">(with autocomplete)</span>
          )}
        </Label>
        <Input
          ref={inputRef}
          id="venueAddress"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hasGoogleMaps ? "Start typing to search..." : "Enter full venue address"}
          className="rounded-lg border-gray-200 mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {hasGoogleMaps 
            ? "Start typing and select from suggestions for accurate location"
            : "Enter full address including city and postcode"}
        </p>
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

      {!hasGoogleMaps && (
        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
          💡 Tip: Add Google Maps API key to enable address autocomplete and more accurate location detection.
        </p>
      )}
    </div>
  );
}

