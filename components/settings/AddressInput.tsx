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
 * Enhanced Address Input with Google Places Autocomplete
 * Falls back to basic input if Google Maps API is not available
 */
export function AddressInput({ value, onChange, onCoordinatesChange }: AddressInputProps) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [hasGoogleMaps, setHasGoogleMaps] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Load Google Maps API
  useEffect(() => {
    console.log('AddressInput: Loading Google Maps API...');
    setGoogleMapsError(null);
    loadGoogleMapsAPI()
      .then(() => {
        console.log('AddressInput: Google Maps API loaded successfully');
        setHasGoogleMaps(true);
        setGoogleMapsError(null);
      })
      .catch((error) => {
        console.warn('AddressInput: Google Maps not available:', error.message);
        setHasGoogleMaps(false);
        setGoogleMapsError(error.message);
      });
  }, []);

  // Initialize Google Places Autocomplete - only if Google Maps is working
  useEffect(() => {
    if (!hasGoogleMaps || !inputRef.current || autocompleteRef.current) return;

    console.log('AddressInput: Initializing Google Places Autocomplete...');
    try {
      // Check if Google Maps is actually available before initializing
      if (typeof window.google === 'undefined' || !window.google.maps || !window.google.maps.places) {
        console.warn('AddressInput: Google Maps not fully loaded, skipping autocomplete');
        setHasGoogleMaps(false);
        setGoogleMapsError('Google Maps API not properly loaded');
        return;
      }

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        // Only update if user actually selected a place (not just typing)
        if (place.formatted_address && place.place_id) {
          console.log('AddressInput: Place selected from autocomplete:', place.formatted_address);
          
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

      // Ensure the input remains editable
      const input = inputRef.current;
      if (input) {
        input.addEventListener('keydown', (e) => {
          // Allow all key presses to ensure input is never blocked
          e.stopPropagation();
        });
      }

      autocompleteRef.current = autocomplete;
      console.log('AddressInput: Google Places Autocomplete initialized successfully');
    } catch (error) {
      console.error('AddressInput: Error initializing Google Places:', error);
      setHasGoogleMaps(false);
      setGoogleMapsError('Failed to initialize Google Places');
    }
  }, [hasGoogleMaps, onChange, onCoordinatesChange]);

  // Reinitialize autocomplete when input ref changes (e.g., after clearing)
  useEffect(() => {
    if (hasGoogleMaps && inputRef.current && !autocompleteRef.current) {
      console.log('AddressInput: Reinitializing autocomplete after field change...');
      try {
        // Check if Google Maps is actually available before reinitializing
        if (typeof window.google === 'undefined' || !window.google.maps || !window.google.maps.places) {
          console.warn('AddressInput: Google Maps not fully loaded, skipping reinitialization');
          setHasGoogleMaps(false);
          setGoogleMapsError('Google Maps API not properly loaded');
          return;
        }

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          fields: ['formatted_address', 'geometry', 'name', 'address_components'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (place.formatted_address && place.place_id) {
            console.log('AddressInput: Place selected from autocomplete:', place.formatted_address);
            
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

        // Ensure the input remains editable
        const input = inputRef.current;
        if (input) {
          input.addEventListener('keydown', (e) => {
            // Allow all key presses to ensure input is never blocked
            e.stopPropagation();
          });
        }

        autocompleteRef.current = autocomplete;
        console.log('AddressInput: Autocomplete reinitialized successfully');
      } catch (error) {
        console.error('AddressInput: Error reinitializing autocomplete:', error);
        setGoogleMapsError('Failed to reinitialize autocomplete');
      }
    }
  }, [hasGoogleMaps, value, onChange, onCoordinatesChange]);

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

  // Ensure input is always editable
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.disabled = false;
      inputRef.current.readOnly = false;
    }
  }, [hasGoogleMaps, googleMapsError]);

  // Debounce manual geocoding - always run as fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value && value.length > 5) {
        // Always try manual geocoding as fallback, even if Google Maps is available
        handleManualGeocode(value);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [value]);

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
                onChange('');
                setMapUrl(null);
                // Reset autocomplete to allow fresh suggestions
                if (autocompleteRef.current) {
                  autocompleteRef.current = null;
                }
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
          onChange={(e) => {
            // Always allow manual typing, even with autocomplete enabled
            onChange(e.target.value);
            // Clear any Google Maps errors when user types
            if (googleMapsError) {
              setGoogleMapsError(null);
            }
          }}
          onFocus={(e) => {
            // Additional autocomplete prevention on focus
            e.target.setAttribute('autocomplete', 'new-password');
          }}
          onKeyDown={(e) => {
            // Ensure input is never blocked - allow all key presses
            e.stopPropagation();
          }}
          placeholder="Start typing to search for addresses..."
          className="rounded-lg border-gray-200"
          autoComplete="new-password" // Stronger autocomplete prevention
          type="text"
          disabled={false} // Explicitly ensure input is never disabled
        />
        
        {/* Error message display */}
        {googleMapsError && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ {googleMapsError} - You can still type addresses manually
          </p>
        )}
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
          💡 Tip: {googleMapsError ? 'Google Maps is not available - ' : 'Add Google Maps API key to enable '}address autocomplete and more accurate location detection. You can still type addresses manually.
        </p>
      )}
    </div>
  );
}

