"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Search, Edit3 } from "lucide-react";
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
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Load Google Maps API
  useEffect(() => {
    console.log('AddressInput: Loading Google Maps API...');
    loadGoogleMapsAPI()
      .then(() => {
        console.log('AddressInput: Google Maps API loaded successfully');
        setHasGoogleMaps(true);
      })
      .catch((error) => {
        console.warn('AddressInput: Google Maps not available:', error.message);
        setHasGoogleMaps(false);
      });
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!hasGoogleMaps || !inputRef.current || autocompleteRef.current || !autocompleteEnabled) return;

    console.log('AddressInput: Initializing Google Places Autocomplete...');
    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (place.formatted_address && place.place_id) {
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
      console.log('AddressInput: Google Places Autocomplete initialized successfully');
    } catch (error) {
      console.error('AddressInput: Error initializing Google Places:', error);
      setHasGoogleMaps(false);
    }
  }, [hasGoogleMaps, autocompleteEnabled, onChange, onCoordinatesChange]);

  // Clean up autocomplete when disabled
  useEffect(() => {
    if (!autocompleteEnabled && autocompleteRef.current) {
      // Clear the autocomplete
      autocompleteRef.current = null;
    }
  }, [autocompleteEnabled]);

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
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="venueAddress" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Venue Address
          </Label>
          {hasGoogleMaps && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAutocompleteEnabled(!autocompleteEnabled)}
              className="h-7 px-2 text-xs"
            >
              {autocompleteEnabled ? (
                <>
                  <Edit3 className="h-3 w-3 mr-1" />
                  Manual
                </>
              ) : (
                <>
                  <Search className="h-3 w-3 mr-1" />
                  Autocomplete
                </>
              )}
            </Button>
          )}
        </div>
        
        <Input
          ref={inputRef}
          id="venueAddress"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            autocompleteEnabled 
              ? "Start typing to search for addresses..." 
              : "Enter full venue address manually"
          }
          className="rounded-lg border-gray-200"
        />
        
        <p className="text-xs text-muted-foreground mt-1">
          {autocompleteEnabled 
            ? "💡 Autocomplete enabled - type to see address suggestions"
            : "✏️ Manual mode - type your address directly"}
        </p>
        
        {/* Debug info - remove in production */}
        <p className="text-xs text-gray-500 mt-1">
          Debug: Google Maps {hasGoogleMaps ? '✅ Loaded' : '❌ Not loaded'} | API Key: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? '✅ Set' : '❌ Missing'} | Autocomplete: {autocompleteEnabled ? '✅ On' : '❌ Off'}
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

