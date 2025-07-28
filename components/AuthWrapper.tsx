"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

// Simple in-memory cache for session/profile
let cachedUser: any = null;
let cachedProfileComplete: boolean | null = null;

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(cachedUser);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(cachedProfileComplete);
  const router = useRouter();
  const pathname = usePathname();

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/sign-in', '/sign-up', '/order'];
  const isPublicRoute = pathname ? publicRoutes.some(route => pathname.startsWith(route)) : false;

  useEffect(() => {
    let ignore = false;
    
    const initializeAuth = async () => {
      if (!supabase) return;
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (ignore) return;
      
      if (session?.user) {
        setUser(session.user);
        cachedUser = session.user;
        setLoading(false);
      } else {
        setUser(null);
        cachedUser = null;
        setLoading(false);
        
        // Only redirect to sign-in if not on a public route
        if (!isPublicRoute) {
          router.replace("/sign-in");
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (ignore) return;
          
          console.log("Auth state changed:", event, session?.user?.email);
          
          if (session?.user) {
            setUser(session.user);
            cachedUser = session.user;
            setLoading(false);
            
            // If user just signed in and we're on sign-in page, redirect to dashboard
            if (event === 'SIGNED_IN' && pathname === '/sign-in') {
              router.replace("/dashboard");
            }
          } else {
            setUser(null);
            cachedUser = null;
            setLoading(false);
            
            // Only redirect to sign-in if not on a public route
            if (!isPublicRoute) {
              router.replace("/sign-in");
            }
          }
        }
      );

      return () => {
        ignore = true;
        subscription?.unsubscribe();
      };
    }
  }, [router, pathname, isPublicRoute]);

  useEffect(() => {
    if (!user) return;
    if (cachedProfileComplete !== null) {
      setProfileComplete(cachedProfileComplete);
      setLoading(false);
      return;
    }
    
    let ignore = false;
    async function checkProfile() {
      if (!supabase || !user) return;
      
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
        
      if (!ignore) {
        if (!data || error) {
          setProfileComplete(false);
          cachedProfileComplete = false;
          router.replace("/complete-profile");
        } else {
          setProfileComplete(true);
          cachedProfileComplete = true;
          setLoading(false);
        }
      }
    }
    
    checkProfile();
    return () => { ignore = true; };
  }, [user, router]);

  // Don't show loading for public routes
  if (isPublicRoute && !user) {
    return <>{children}</>;
  }

  if (loading || profileComplete === false) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
    </div>
  );
  
  return <>{children}</>;
} 