"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus } from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface Venue {

}

interface VenueSwitcherProps {
  currentVenueId?: string;
}

export function VenueSwitcher({ currentVenueId }: VenueSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const supabase = createClient();

      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (!user) {
        setLoading(false);
        return;
      }

      // Get user's venues using the RPC function
      const { data: venuesData, error } = await supabase.rpc("get_user_venues", {

      if (error) {
        // Empty block
      } else {
        setVenues(venuesData || []);
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const handleVenueChange = (venueId: string) => {
    if (venueId === "add-new") {
      router.push("/onboarding");
      return;
    }

    // Replace the venueId in the current path
    if (pathname && currentVenueId) {
      const newPath = pathname.replace(`/dashboard/${currentVenueId}`, `/dashboard/${venueId}`);
      router.push(newPath);
    } else {
      router.push(`/dashboard/${venueId}`);
    }
  };

  if (loading) {
    return <div className="w-[200px] h-10 bg-muted animate-pulse rounded-md" />;
  }

  if (venues.length === 0) {
    return null;
  }

  // If only one venue, show it without dropdown
  if (venues.length === 1 && !currentVenueId) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{venues[0].venue_name}</span>
      </div>
    );
  }

  const currentVenue = venues.find((v) => v.venue_id === currentVenueId);

  return (
    <Select value={currentVenueId || venues[0]?.venue_id} onValueChange={handleVenueChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">
              {currentVenue?.venue_name || venues[0]?.venue_name || "Select venue"}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {venues.map((venue) => (
          <SelectItem key={venue.venue_id} value={venue.venue_id}>
            <div className="flex flex-col">
              <span className="font-medium">{venue.venue_name}</span>
              {venue.organization_name && (
                <span className="text-xs text-muted-foreground">
                  {venue.organization_name} • {venue.user_role}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
        <SelectItem value="add-new">
          <div className="flex items-center gap-2 text-purple-600">
            <Plus className="h-4 w-4" />
            <span className="font-medium">Add New Venue</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
