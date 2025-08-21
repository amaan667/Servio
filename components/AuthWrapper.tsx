use client;
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/sb-client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading: loading } = useAuth();

  // Strict public routes (accessible without auth)
  const publicRoutes = ["/", "/sign-in", "/sign-up", "/order"];
  const isPublicRoute = pathname
    ? publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      )
    : false;

  const isAuthCallback = pathname === "/auth/callback";

  useEffect(() => {
    if (loading) return; // Wait for auth state

    // If unauthenticated and attempting to access a protected route -> redirect
    if (!session && !isPublicRoute && !isAuthCallback) {
      router.replace("/sign-in");
      return;
    }

    // If authenticated, verify venue/profile unless already on completion or callback page
    if (session && !isAuthCallback && pathname !== "/complete-profile") {
      const checkProfile = async () => {
        try {
          const { data, error } = await supabase
            .from("venues")
            .select("venue_id")
            .eq("owner_id", session.user.id)
            .maybeSingle();

          if (error || !data) {
            setProfileComplete(false);
            if (pathname !== "/complete-profile") {
              router.replace("/complete-profile");
            }
          } else {
            setProfileComplete(true);
          }
        } catch {
          setProfileComplete(false);
          if (pathname !== "/complete-profile") {
            router.replace("/complete-profile");
          }
        }
      };
      checkProfile();
    }
  }, [session, loading, pathname, isPublicRoute, isAuthCallback, router]);

  // Immediately allow rendering for public routes & the auth callback route
  if (isPublicRoute || isAuthCallback) return <>{children}</>;

  // Show loading state while determining auth or profile status
  if (loading || !session) {
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
