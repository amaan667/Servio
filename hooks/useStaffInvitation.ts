/**
 * Shared hook for staff invitation functionality
 * Eliminates duplicate invitation logic across components
 */

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  email?: string;
}

interface UseStaffInvitationOptions {
  venueId: string;
  onSuccess?: () => void;
}

export function useStaffInvitation({ venueId, onSuccess }: UseStaffInvitationOptions) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedStaffForInvite, setSelectedStaffForInvite] = useState<StaffMember | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const { toast } = useToast();

  const handleInviteClick = (member: StaffMember) => {
    setSelectedStaffForInvite(member);
    setInviteEmail("");
    setInviteDialogOpen(true);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    if (!selectedStaffForInvite) {
      return;
    }

    // Prevent inviting yourself
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user ?? null;

    if (user?.email?.toLowerCase() === inviteEmail.trim().toLowerCase()) {
      toast({
        title: "Error",
        description: "You cannot invite yourself. You already have access to this venue.",
        variant: "destructive",
      });
      return;
    }

    setInviteLoading(true);

    try {
      // Send invitation - API will get user from cookies
      const requestBody = {
        venue_id: venueId,
        email: inviteEmail.trim(),
        role: selectedStaffForInvite.role,
      };

      const res = await fetch("/api/staff/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        credentials: "include", // Ensure cookies are sent
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      // Show success message based on email status
      if (data.emailSent) {
        const isRefresh = data.message?.includes("refreshed");
        toast({
          title: isRefresh ? "Invitation refreshed!" : "Invitation sent!",
          description: isRefresh
            ? `A new invitation link has been sent to ${inviteEmail}`
            : `Invitation sent to ${inviteEmail} with ${selectedStaffForInvite.role} role`,
        });
      } else {
        toast({
          title: "Invitation created",
          description:
            "Invitation created but email failed to send. Check server logs for invitation link.",
          variant: "destructive",
        });
      }

      setInviteDialogOpen(false);
      setInviteEmail("");
      setSelectedStaffForInvite(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const closeInviteDialog = () => {
    setInviteDialogOpen(false);
    setInviteEmail("");
    setSelectedStaffForInvite(null);
  };

  return {
    inviteDialogOpen,
    inviteEmail,
    selectedStaffForInvite,
    inviteLoading,
    setInviteEmail,
    handleInviteClick,
    handleSendInvite,
    closeInviteDialog,
  };
}
