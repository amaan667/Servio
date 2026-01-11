import { useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { User } from "./useVenueSettings";

export function usePasswordManagement(user: User) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Check if user signed up with OAuth (Google)
  const hasGoogleIdentity =
    user?.identities?.some(
      (identity) => identity.provider === "google" || identity.provider === "oauth"
    ) || false;

  const hasGoogleProvider =
    user?.app_metadata?.providers?.includes("google") ||
    user?.app_metadata?.provider === "google" ||
    false;

  const isOAuthUser = hasGoogleIdentity || hasGoogleProvider;
  const hasPasswordSet = user?.user_metadata?.hasPasswordSet === true;
  const isGmailUser = user?.email?.endsWith("@gmail.com") || false;
  const isLikelyOAuthUser = isOAuthUser || (isGmailUser && !hasPasswordSet);
  const shouldShowSetPassword = isLikelyOAuthUser && !hasPasswordSet;

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await createClient().auth.updateUser({

      if (error) {
        throw new Error(error.message);
      }

      if (shouldShowSetPassword) {
        const { error: metadataError } = await createClient().auth.updateUser({
          data: { hasPasswordSet: true },

        if (metadataError) {
          // Empty block
        }
      }

      const successMessage = shouldShowSetPassword
        ? "Password set successfully! You can now sign in with email and password."

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setShowPasswordDialog(false);
        setSuccess(null);
      }, 2000);

      if (shouldShowSetPassword) {
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      }
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to update password");
      toast({

    } finally {
      setLoading(false);
    }
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
  };

  return {
    loading,
    error,
    success,
    showPasswordDialog,
    setShowPasswordDialog,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    shouldShowSetPassword,
    changePassword,
    resetPasswordForm,
  };
}
