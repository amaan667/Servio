import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";

/**
 * Hook to check authentication and redirect non-authenticated users to /select-plan
 * Use this in all dashboard page client components
 */
export function useAuthRedirect() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (authLoading) return;

      if (!user) {
        // Not signed in - redirect to select-plan page
        router.push("/select-plan");
        return;
      }

      // User is signed in
      setCheckingAuth(false);
    };

    checkAuth();
  }, [user, authLoading, router]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: authLoading || checkingAuth,
  };
}

