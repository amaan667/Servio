'use client';
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useAuth();

  // Strict public routes (accessible without auth)
  const publicRoutes = ["/", "/sign-in", "/sign-up", "/order"];
  const isPublicRoute = pathname
    ? publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      )
    : false;

  const isAuthCallback = pathname === "/auth/callback";
  const isDashboardIndex = pathname === "/dashboard";

  useEffect(() => {
    if (loading || isChecking) return; // Wait for auth state and prevent concurrent checks

    console.log('[AUTH_WRAPPER] Auth state changed:', { 
      hasSession: !!session, 
      pathname, 
      isPublicRoute, 
      isAuthCallback,
      isDashboardIndex 
    });

    // If unauthenticated and attempting to access a protected route -> redirect
    if (!session && !isPublicRoute && !isAuthCallback) {
      console.log('[AUTH_WRAPPER] No session, redirecting to sign-in');
      router.replace("/sign-in");
      return;
    }

    // If authenticated, verify venue/profile unless already on completion or callback page
    if (session && !isAuthCallback && pathname !== "/complete-profile" && !isDashboardIndex) {
      console.log('[AUTH_WRAPPER] Checking profile completion for user:', session.user.id);
      setIsChecking(true);
      
      const checkProfile = async () => {
        try {
          // First verify the session is still valid
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) {
            console.error('[AUTH_WRAPPER] Session validation failed:', userError);
            // Clear invalid session and redirect to sign-in
            await supabase.auth.signOut();
            router.replace('/sign-in');
            return;
          }

          const { data, error } = await supabase
            .from("venues")
            .select("venue_id")
            .eq("owner_id", session.user.id)
            .maybeSingle();

          if (error) {
            console.error('[AUTH_WRAPPER] Database error checking profile:', error);
            // Don't redirect on database errors, just show incomplete profile
            setProfileComplete(false);
            if (pathname !== "/complete-profile") {
              router.replace("/complete-profile");
            }
            return;
          }

          if (!data) {
            console.log('[AUTH_WRAPPER] No venue found, profile incomplete');
            setProfileComplete(false);
            if (pathname !== "/complete-profile") {
              router.replace("/complete-profile");
            }
          } else {
            console.log('[AUTH_WRAPPER] Venue found, profile complete');
            setProfileComplete(true);
          }
        } catch (error) {
          console.error('[AUTH_WRAPPER] Error checking profile:', error);
          setProfileComplete(false);
          if (pathname !== "/complete-profile") {
            router.replace("/complete-profile");
          }
        } finally {
          setIsChecking(false);
        }
      };
      checkProfile();
    } else if (session && isDashboardIndex) {
      // For dashboard index, let the dashboard page handle the routing
      console.log('[AUTH_WRAPPER] Dashboard index detected, letting dashboard page handle routing');
      setProfileComplete(true);
    }
  }, [session, loading, pathname, isPublicRoute, isAuthCallback, isDashboardIndex, router, isChecking]);

  // Immediately allow rendering for public routes & the auth callback route
  if (isPublicRoute || isAuthCallback) {
    console.log('[AUTH_WRAPPER] Rendering public route or auth callback');
    return <>{children}</>;
  }

  // For dashboard index, let it handle its own loading state
  if (isDashboardIndex) {
    console.log('[AUTH_WRAPPER] Rendering dashboard index');
    return <>{children}</>;
  }

  // Show loading state while determining auth or profile status
  if (loading || !session || isChecking) {
    console.log('[AUTH_WRAPPER] Showing loading state:', { loading, hasSession: !!session, isChecking });
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
      </div>
    );
  }

  if (profileComplete === false && pathname !== "/complete-profile") {
    console.log('[AUTH_WRAPPER] Profile incomplete, showing loading');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
      </div>
    );
  }

  console.log('[AUTH_WRAPPER] Rendering protected content');
  return <>{children}</>;
}
