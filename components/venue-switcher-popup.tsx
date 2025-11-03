"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  MapPin,
  Phone,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Store,
  Settings,
} from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Venue {
  venue_id: string;
  venue_name: string;
  address?: string;
  phone?: string;
  description?: string;
  is_primary?: boolean;
  created_at: string;
}

interface VenueSwitcherPopupProps {
  currentVenueId: string;
  onVenueChange: (venueId: string) => void;
}

export default function VenueSwitcherPopup({
  currentVenueId,
  onVenueChange,
}: VenueSwitcherPopupProps) {
  const [open, setOpen] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const router = useRouter();

  // Get cached venue name synchronously to prevent flicker
  const getCachedVenueName = (venueId: string) => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(`venue_name_${venueId}`);
  };

  const [currentVenueName, setCurrentVenueName] = useState<string | null>(
    getCachedVenueName(currentVenueId)
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    description: "",
  });

  // Load current venue name on mount and when currentVenueId changes
  useEffect(() => {
    const loadCurrentVenueName = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("venues")
          .select("venue_name")
          .eq("venue_id", currentVenueId)
          .single();

        if (data) {
          setCurrentVenueName(data.venue_name);
          // Cache the venue name
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`venue_name_${currentVenueId}`, data.venue_name);
          }
        }
      } catch {
        // Silently handle - will show "Select Venue"
      }
    };

    if (currentVenueId) {
      loadCurrentVenueName();
    }
  }, [currentVenueId]);

  // Load all venues when dialog opens
  useEffect(() => {
    if (open) {
      loadVenues();
    }
  }, [open]);

  const loadVenues = async () => {
    try {
      const supabase = createClient();

      // Get current user first
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;
      if (!user) {
        return;
      }

      // Only load venues owned by the current user
      const { data: venuesData, error } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setVenues(venuesData || []);
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load venues",
        variant: "destructive",
      });
    }
  };

  const handleAddVenue = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Venue name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Get current user
      const { data: userSessionData } = await supabase.auth.getSession();
      const user = userSessionData?.session?.user ?? null;
      if (!user) throw new Error("User not authenticated");

      // Get organization_id from current venue
      const { data: currentVenue } = await supabase
        .from("venues")
        .select("organization_id")
        .eq("venue_id", currentVenueId)
        .single();

      // Generate a unique venue_id
      const venueId = `venue-${crypto.randomUUID().replace(/-/g, "")}`;

      const { data: insertData, error } = await supabase
        .from("venues")
        .insert({
          venue_id: venueId,
          venue_name: formData.name.trim(),
          address: formData.address.trim() || null,
          phone: formData.phone.trim() || null,
          description: formData.description.trim() || null,
          organization_id: currentVenue?.organization_id,
          owner_user_id: user.id,
          is_primary: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Venue "${formData.name}" has been added`,
      });

      // Reset form and close modals
      setFormData({ name: "", address: "", phone: "", description: "" });
      setShowAddForm(false);

      // Reload venues to show the new one
      await loadVenues();

      // Automatically switch to the newly added venue
      if (insertData && "venue_id" in insertData) {
        onVenueChange((insertData as { venue_id: string }).venue_id);
      }

      // Close the main modal
      setOpen(false);
    } catch (_error) {
      toast({
        title: "Error",
        description: _error instanceof Error ? _error.message : "Failed to add venue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditVenue = async () => {
    if (!editingVenue || !formData.name.trim()) {
      toast({
        title: "Error",
        description: "Venue name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("venues")
        .update({
          venue_name: formData.name.trim(),
          address: formData.address.trim() || null,
          phone: formData.phone.trim() || null,
          description: formData.description.trim() || null,
        })
        .eq("venue_id", editingVenue.venue_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Venue "${formData.name}" has been updated`,
      });

      setFormData({ name: "", address: "", phone: "", description: "" });
      setEditingVenue(null);
      await loadVenues();
      setOpen(false);
    } catch (_error) {
      toast({
        title: "Error",
        description: _error instanceof Error ? _error.message : "Failed to update venue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVenue = async (venueId: string, venueName: string) => {
    if (!confirm(`Are you sure you want to delete "${venueName}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.from("venues").delete().eq("venue_id", venueId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Venue "${venueName}" has been deleted`,
      });

      loadVenues();
    } catch (_error) {
      toast({
        title: "Error",
        description: _error instanceof Error ? _error.message : "Failed to delete venue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.venue_name,
      address: venue.address || "",
      phone: venue.phone || "",
      description: venue.description || "",
    });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingVenue(null);
    setFormData({ name: "", address: "", phone: "", description: "" });
    setShowAddForm(false);
  };

  const currentVenue = venues.find((v) => v.venue_id === currentVenueId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group flex items-center gap-2 h-10 px-4 text-sm font-medium bg-purple-600 hover:bg-white hover:border-purple-600 border-2 border-transparent transition-all duration-200 rounded-md">
          <Building2 className="h-4 w-4 text-white group-hover:text-purple-600 transition-colors" />
          <span className="text-white group-hover:text-purple-600 transition-colors">
            {currentVenueName || currentVenue?.venue_name || "Select Venue"}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Venue Management
          </DialogTitle>
          <DialogDescription>
            Switch between your venues or add new ones to manage multiple locations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Venue */}
          {currentVenue && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Store className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-blue-900">{currentVenue.venue_name}</h3>
                    {currentVenue.is_primary && (
                      <Badge variant="default" className="text-xs">
                        Primary
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  </div>
                  {currentVenue.address && (
                    <p className="text-sm text-blue-700 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {currentVenue.address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Venues List */}
          <div className="space-y-3">
            <h3 className="font-semibold">Your Venues</h3>
            {venues.map((venue) => (
              <div
                key={venue.venue_id}
                className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                  venue.venue_id === currentVenueId
                    ? "border-blue-500 bg-blue-50"
                    : "border-border hover:border-primary/50 cursor-pointer hover:bg-gray-50"
                }`}
                onClick={() => {
                  if (venue.venue_id !== currentVenueId) {
                    // Pre-cache new venue name BEFORE switching to prevent flicker
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem(`venue_name_${venue.venue_id}`, venue.venue_name);
                      // DON'T clear old cache - prevents white flash during switch
                      // Dashboard will auto-refresh with new data when it mounts
                        `[Venue Switch] Pre-cached name for ${venue.venue_id} (${venue.venue_name}), navigating...`
                      );
                    }
                    onVenueChange(venue.venue_id);
                    setOpen(false);
                  } else {
                    // Intentionally empty
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Store className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{venue.venue_name}</h4>
                      {venue.is_primary && (
                        <Badge variant="default" className="text-xs">
                          Primary
                        </Badge>
                      )}
                      {venue.venue_id === currentVenueId ? (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Click to switch</span>
                      )}
                    </div>
                    {venue.address && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3" />
                        {venue.address}
                      </p>
                    )}
                    {venue.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                        <Phone className="h-3 w-3" />
                        {venue.phone}
                      </p>
                    )}
                    {venue.description && (
                      <p className="text-sm text-gray-500">{venue.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(venue);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    {!venue.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVenue(venue.venue_id, venue.venue_name);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingVenue) && (
            <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
              <h3 className="font-semibold mb-3">
                {editingVenue ? "Edit Venue" : "Add New Venue"}
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Venue Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Downtown Location"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main St, City, State"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Brief description of this venue..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={editingVenue ? handleEditVenue : handleAddVenue}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Saving..." : editingVenue ? "Update Venue" : "Add Venue"}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} disabled={loading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Venue Button */}
          {!showAddForm && !editingVenue && (
            <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add New Venue
            </Button>
          )}

          {/* Settings Link */}
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                router.push(`/dashboard/${currentVenueId}/settings`);
              }}
              className="w-full justify-start text-sm text-gray-600 hover:text-gray-900"
            >
              <Settings className="h-4 w-4 mr-2" />
              ⚙️ Manage venue in Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
