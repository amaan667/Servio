'use client';
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, authReady } = useAuth();

  // Strict public routes (accessible without auth)
  const publicRoutes = ["/", "/sign-in", "/sign-up", "/order"];
  const isPublicRoute = pathname
    ? publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      )
    : false;

  const isAuthCallback = pathname === "/auth/callback";

  useEffect(() => {
    if (!authReady) return; // Wait for auth to be ready

    // If unauthenticated and attempting to access a protected route -> redirect
    if (!session && !isPublicRoute && !isAuthCallback) {
      console.log('[AUTH WRAPPER] No session, redirecting to sign-in');
      router.replace("/sign-in");
      return;
    }

    // If authenticated, verify venue/profile unless already on completion or callback page
    if (session && !isAuthCallback && pathname !== "/complete-profile") {
      const checkProfile = async () => {
        try {
          console.log('[AUTH WRAPPER] Checking profile for user:', session.user.id);
          const { data, error } = await supabase
            .from("venues")
            .select("venue_id")
            .eq("owner_id", session.user.id)
            .maybeSingle();

          if (error) {
            console.error('[AUTH WRAPPER] Error checking profile:', error);
            setProfileComplete(false);
            if (pathname !== "/complete-profile") {
              router.replace("/complete-profile");
            }
          } else if (!data) {
            console.log('[AUTH WRAPPER] No venue found, redirecting to complete profile');
            setProfileComplete(false);
            if (pathname !== "/complete-profile") {
              router.replace("/complete-profile");
            }
          } else {
            console.log('[AUTH WRAPPER] Profile complete, venue found:', data.venue_id);
            setProfileComplete(true);
          }
        } catch (error) {
          console.error('[AUTH WRAPPER] Exception checking profile:', error);
          setProfileComplete(false);
          if (pathname !== "/complete-profile") {
            router.replace("/complete-profile");
          }
        }
      };
      
      // Add a small delay to ensure session is fully established
      setTimeout(checkProfile, 500);
    }
  }, [session, authReady, pathname, isPublicRoute, isAuthCallback, router]);

  // Immediately allow rendering for public routes & the auth callback route
  if (isPublicRoute || isAuthCallback) return <>{children}</>;

  // Show loading state while auth is not ready
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
      </div>
    );
  }

  // Show loading state while determining profile status for authenticated users
  if (session && profileComplete === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
      </div>
    );
  }

  if (profileComplete === false && pathname !== "/complete-profile") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
      </div>
    );
  }

  return <>{children}</>;
}
