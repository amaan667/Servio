"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Clock, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface WaitingParty {
  id: string;
  customer_name: string;
  customer_phone?: string;
  party_size: number;
  status: "WAITING" | "SEATED" | "CANCELLED" | "NO_SHOW";
  created_at: string;
  seated_at?: string;
  table_id?: string;
}

interface WaitingListProps {
  venueId: string;
  availableTables: Array<{ id: string; label: string; seat_count: number }>;
  onPartySeated?: () => void;
}

export function WaitingList({ venueId, availableTables, onPartySeated }: WaitingListProps) {
  const [waitingParties, setWaitingParties] = useState<WaitingParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [seatingParty, setSeatingParty] = useState<string | null>(null);
  const [newParty, setNewParty] = useState({
    customer_name: "",
    customer_phone: "",
    party_size: 2,
  });

  const supabase = createClient();

  useEffect(() => {
    fetchWaitingParties();
  }, [venueId]);

  const fetchWaitingParties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("waiting_list")
        .select("*")
        .eq("venue_id", venueId)
        .eq("status", "WAITING")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setWaitingParties(data || []);
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const addToWaitingList = async () => {
    try {
      const { data, error } = await supabase
        .from("waiting_list")
        .insert({
          venue_id: venueId,
          customer_name: newParty.customer_name,
          customer_phone: newParty.customer_phone || null,
          party_size: newParty.party_size,
        })
        .select()
        .single();

      if (error) throw error;

      setWaitingParties((prev) => [...prev, data]);
      setNewParty({ customer_name: "", customer_phone: "", party_size: 2 });
      setShowAddDialog(false);
    } catch (_error) {
      // Error silently handled
    }
  };

  const seatParty = async (waitingId: string, tableId: string) => {
    try {
      setSeatingParty(waitingId);

      const { data, error } = await supabase.rpc("api_seat_waiting_party", {
        p_waiting_id: waitingId,
        p_table_id: tableId,
        p_venue_id: venueId,
      });

      if (error) throw error;

      if (data.success) {
        // Remove from waiting list
        setWaitingParties((prev) => prev.filter((p) => p.id !== waitingId));
        onPartySeated?.();
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setSeatingParty(null);
    }
  };

  const removeFromWaitingList = async (waitingId: string) => {
    try {
      const { error } = await supabase
        .from("waiting_list")
        .update({ status: "CANCELLED" })
        .eq("id", waitingId);

      if (error) throw error;

      setWaitingParties((prev) => prev.filter((p) => p.id !== waitingId));
    } catch (_error) {
      // Error silently handled
    }
  };

  const getWaitTime = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const getSuitableTables = (partySize: number) => {
    return availableTables.filter(
      (table) => table.seat_count >= partySize && !seatingParty // Don't show tables that are currently being seated
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading waiting list...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Waiting List</h3>
          <p className="text-sm text-gray-900">
            {waitingParties.length} {waitingParties.length === 1 ? "party" : "parties"} waiting
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Party
        </Button>
      </div>

      {/* Waiting Parties */}
      {waitingParties.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Users className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <h4 className="text-lg font-medium mb-2">No parties waiting</h4>
              <p className="text-gray-900 mb-4">Add parties to the waiting list when they arrive</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Party
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {waitingParties.map((party) => (
            <Card key={party.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{party.customer_name}</h4>
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {party.party_size}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {getWaitTime(party.created_at)}
                      </Badge>
                    </div>
                    {party.customer_phone && (
                      <p className="text-sm text-gray-900">{party.customer_phone}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Seat Party Dropdown */}
                    <select
                      className="text-sm border rounded px-2 py-1"
                      onChange={(e) => {
                        if (e.target.value) {
                          seatParty(party.id, e.target.value);
                        }
                      }}
                      disabled={seatingParty === party.id}
                      defaultValue=""
                    >
                      <option value="">Seat at...</option>
                      {getSuitableTables(party.party_size).map((table) => (
                        <option key={table.id} value={table.id}>
                          Table {table.label} ({table.seat_count} seats)
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFromWaitingList(party.id)}
                      disabled={seatingParty === party.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Party Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Party to Waiting List</DialogTitle>
            <DialogDescription>Add a party that's waiting to be seated</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={newParty.customer_name}
                onChange={(e) =>
                  setNewParty((prev) => ({ ...prev, customer_name: e.target.value }))
                }
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <Label htmlFor="customer_phone">Phone Number</Label>
              <Input
                id="customer_phone"
                value={newParty.customer_phone}
                onChange={(e) =>
                  setNewParty((prev) => ({ ...prev, customer_phone: e.target.value }))
                }
                placeholder="Enter phone number (optional)"
              />
            </div>

            <div>
              <Label htmlFor="party_size">Party Size</Label>
              <Input
                id="party_size"
                type="number"
                min="1"
                max="20"
                value={newParty.party_size}
                onChange={(e) =>
                  setNewParty((prev) => ({ ...prev, party_size: parseInt(e.target.value) || 2 }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addToWaitingList} disabled={!newParty.customer_name.trim()}>
              Add to Waiting List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
