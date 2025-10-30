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

    // Try to get user context for audit trail (optional - cookie-free operation)
    let user = null;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      user = data?.session?.user ?? null;

      if (user) {
        console.log("[STAFF INVITATION] User context available:", user.email);

        // Prevent inviting yourself if we have user context
        if (user.email?.toLowerCase() === inviteEmail.trim().toLowerCase()) {
          toast({
            title: "Error",
            description: "You cannot invite yourself. You already have access to this venue.",
            variant: "destructive",
          });
          return;
        }
      } else {
        console.log("[STAFF INVITATION] No user context (cookie-free operation)");
      }
    } catch (error) {
      // If we can't get user context, that's fine - continue without it
      console.log("[STAFF INVITATION] Could not get user context, continuing cookie-free:", error);
    }

    setInviteLoading(true);

    try {
      // Send invitation (cookie-free - user context optional for audit trail)
      const requestBody = {
        venue_id: venueId,
        email: inviteEmail.trim(),
        role: selectedStaffForInvite.role,
        // Optional user context for audit trail
        ...(user?.id && { user_id: user.id }),
        ...(user?.email && { user_email: user.email }),
        ...(user && { user_name: user.user_metadata?.full_name || user.email }),
      };

      console.log("[STAFF INVITATION] Sending invitation (cookie-free):", {
        venue_id: requestBody.venue_id,
        email: requestBody.email,
        role: requestBody.role,
        has_user_context: !!user,
      });

      const res = await fetch("/api/staff/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const responseData = await res.json();

      console.log("[STAFF INVITATION] Response:", {
        status: res.status,
        statusText: res.statusText,
        data: responseData,
      });

      if (!res.ok) {
        // Better error messages based on status code
        if (res.status === 400) {
          throw new Error(
            responseData.error ||
              "Missing required information. Please check the form and try again."
          );
        } else {
          throw new Error(responseData.error || "Failed to send invitation");
        }
      }

      // Show success message based on email status
      if (responseData.emailSent) {
        const isRefresh = responseData.message?.includes("refreshed");
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
