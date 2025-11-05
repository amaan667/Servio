import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { TIMEZONES } from "../constants";

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export interface Venue {
  venue_id: string;
  venue_name: string;
  email?: string;
  phone?: string;
  address?: string;
  timezone?: string;
  venue_type?: string;
  service_type?: string;
  operating_hours?: OperatingHours;
  latitude?: number;
  longitude?: number;
}

export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    hasPasswordSet?: boolean;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  identities?: Array<{
    provider: string;
    id: string;
  }>;
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface OperatingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export function useVenueSettings(venue: Venue) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Venue settings state
  const [venueName, setVenueName] = useState(venue.venue_name);
  const [venueEmail, setVenueEmail] = useState(venue.email || "");
  const [venuePhone, setVenuePhone] = useState(venue.phone || "");
  const [venueAddress, setVenueAddress] = useState(venue.address || "");
  const [timezone, setTimezone] = useState(venue.timezone || "Europe/London");
  const [venueType, setVenueType] = useState(venue.venue_type || "restaurant");
  const [serviceType, setServiceType] = useState(venue.service_type || "table_service");
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(
    venue.operating_hours ||
      {
        /* Empty */
      }
  );
  const [latitude, setLatitude] = useState<number | undefined>(venue.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(venue.longitude);

  // Auto-detect timezone on mount
  useEffect(() => {
    if (!venue.timezone) {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const matchingTimezone = TIMEZONES.find((tz) => tz.value === detectedTimezone);
      if (matchingTimezone) {
        setTimezone(detectedTimezone);
      }
    }
  }, [venue.timezone]);

  // Track unsaved changes
  useEffect(() => {
    const changed =
      venueName !== venue.venue_name ||
      venueEmail !== (venue.email || "") ||
      venuePhone !== (venue.phone || "") ||
      venueAddress !== (venue.address || "") ||
      timezone !== (venue.timezone || "Europe/London") ||
      venueType !== (venue.venue_type || "restaurant") ||
      serviceType !== (venue.service_type || "table_service");

    setHasUnsavedChanges(changed);
  }, [venueName, venueEmail, venuePhone, venueAddress, timezone, venueType, serviceType, venue]);

  const updateVenueSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await createClient()
        .from("venues")
        .update({
          venue_name: venueName,
          email: venueEmail || null,
          phone: venuePhone || null,
          address: venueAddress || null,
          timezone: timezone,
          venue_type: venueType,
          service_type: serviceType,
          operating_hours: Object.keys(operatingHours).length > 0 ? operatingHours : null,
          latitude: latitude || null,
          longitude: longitude || null,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venue.venue_id);

      if (error) {
        throw new Error(error.message);
      }

      setSuccess("✅ Venue settings updated successfully!");
      setHasUnsavedChanges(false);

      toast({
        title: "Success",
        description: "✅ Venue settings updated successfully!",
        duration: 3000,
      });

      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to update venue settings");
      toast({
        title: "Error",
        description: _err instanceof Error ? _err.message : "Failed to update venue settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDayHours = (
    day: string,
    field: "open" | "close" | "closed",
    value: string | boolean
  ) => {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day as keyof OperatingHours],
        [field]: value,
      } as DayHours,
    }));
  };

  return {
    loading,
    error,
    success,
    hasUnsavedChanges,
    venueName,
    setVenueName,
    venueEmail,
    setVenueEmail,
    venuePhone,
    setVenuePhone,
    venueAddress,
    setVenueAddress,
    timezone,
    setTimezone,
    venueType,
    setVenueType,
    serviceType,
    setServiceType,
    operatingHours,
    setOperatingHours,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    updateVenueSettings,
    updateDayHours,
  };
}
