"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  console.log("AuthWrapper initialized:", { pathname, loading, session: !!session });

  // Only these routes are public:
  const publicRoutes = ['/', '/sign-in', '/sign-up', '/order', '/auth', '/dashboard'];
  const isPublicRoute = pathname ? publicRoutes.some(route => pathname.startsWith(route)) : false;

  useEffect(() => {
    let ignore = false;
    const checkSession = async () => {
      try {
        // Check if supabase is available
        if (!supabase) {
          console.error("Supabase client not available");
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (ignore) return;
        setSession(session);
        setLoading(false);

        // If no session and not on a public page, redirect:
        if (!session && !isPublicRoute) {
          router.replace("/sign-in");
        }
      } catch (error) {
        console.error("Error checking session:", error);
        if (ignore) return;
        setLoading(false);
        if (!isPublicRoute) {
          router.replace("/sign-in");
        }
      }
    };

    checkSession();

    // Listen for changes:
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);
        setSession(session);
        
        if (!session && !isPublicRoute) {
          router.replace("/sign-in");
        } else if (session && event === 'SIGNED_IN') {
          // User just signed in, check if they have a profile
          try {
            const { data: venue } = await supabase
              .from("venues")
              .select("*")
              .eq("owner_id", session.user.id)
              .maybeSingle();
            
            if (!venue && pathname !== '/complete-profile') {
              router.replace("/complete-profile");
            } else if (venue && pathname === '/sign-in') {
              router.replace("/dashboard");
            }
          } catch (error) {
            console.error("Error checking venue:", error);
          }
        }
      });
      
      return () => {
        ignore = true;
        subscription?.unsubscribe();
      };
    } catch (error) {
      console.error("Error setting up auth state listener:", error);
      setLoading(false);
    }
  }, [router, pathname, isPublicRoute]);

  // Profile check
  useEffect(() => {
    if (!session?.user) return;
    let ignore = false;
    const checkProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", session.user.id)
          .maybeSingle();
        
        if (ignore) return;
        
        if (!data || error) {
          setProfileComplete(false);
          if (pathname !== '/complete-profile' && !pathname?.startsWith('/auth')) {
            router.replace("/complete-profile");
          }
        } else {
          setProfileComplete(true);
        }
      } catch (error) {
        console.error("Error checking profile:", error);
        if (ignore) return;
        setProfileComplete(false);
        if (pathname !== '/complete-profile' && !pathname?.startsWith('/auth')) {
          router.replace("/complete-profile");
        }
      }
    };
    
    checkProfile();
    return () => { ignore = true; };
  }, [session, pathname, router]);

  // Render logic:
  if (isPublicRoute) return <>{children}</>;
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