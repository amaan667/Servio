import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { User } from "./useVenueSettings";

export function useAccountDeletion(user: User) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const deleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      setError("Please type DELETE to confirm account deletion");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use the API route for account deletion
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post("/api/delete-account", {

        venueId: null, // Delete all venues for the user

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to delete account");
      }

      if (!data.success) {
        throw new Error(data.message || data.error || "Failed to delete account");
      }

      // Sign out and clear storage
      try {
        await fetch("/api/auth/signout", {

          },

      } catch (_error) {
        // Error silently handled
      }

      try {
        const { clearAuthStorage } = await import("@/lib/supabase");
        clearAuthStorage();
      } catch (_error) {
        // Error silently handled
      }

      toast({

      // Redirect to home page
      router.push("/");
    } catch (_err) {
      const errorMessage = _err instanceof Error ? _err.message : "Failed to delete account";
      setError(errorMessage);
      toast({

    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    showDeleteDialog,
    setShowDeleteDialog,
    deleteConfirmation,
    setDeleteConfirmation,
    deleteAccount,
  };
}
