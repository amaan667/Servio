"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/sb-client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Use our central auth context
  const { session, isLoading } = useAuth();

  console.log("AuthWrapper initialized:", { pathname, loading: isLoading, session: !!session });

  // Only these routes are public:
  const publicRoutes = ['/', '/sign-in', '/sign-up', '/order', '/auth', '/dashboard'];
  const isPublicRoute = pathname ? publicRoutes.some(route => pathname.startsWith(route)) : false;
  
  // Auth pages handle their own server-side auth, don't block them
  const isAuthPage = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up') || pathname?.startsWith('/auth/callback');

  useEffect(() => {
    // Only handle redirect logic, auth state is managed by AuthenticatedClientProvider
    if (!isLoading) {
      // If no session and not on a public page, redirect:
      if (!session && !isPublicRoute && !isAuthPage) {
        console.log("[AuthWrapper] No session, redirecting to sign-in");
        router.replace("/sign-in");
      } else if (session) {
        // Check if user has completed profile setup
        const checkProfile = async () => {
          try {
            const { data, error } = await supabase
              .from("venues")
              .select("*")
              .eq("owner_id", session.user.id)
              .maybeSingle();
            
            // If signed in but no profile, and not already on complete-profile page
            if (!data && pathname !== '/complete-profile') {
              console.log("[AuthWrapper] No profile, redirecting to complete-profile");
              setProfileComplete(false);
              router.replace("/complete-profile");
            } else {
              setProfileComplete(true);
            }
          } catch (error) {
            console.error("Error checking venue:", error);
            setProfileComplete(false);
            if (pathname !== '/complete-profile' && !pathname?.startsWith('/auth')) {
              router.replace("/complete-profile");
            }
          }
        };
        
        checkProfile();
      }
    }
  }, [session, isLoading, router, pathname, isPublicRoute, isAuthPage]);

  // Render logic:
  if (isPublicRoute) return <>{children}</>;
  
  // Auth pages handle their own server-side auth, don't block them
  if (isAuthPage) return <>{children}</>;
  
  if (isLoading || !session) {
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
