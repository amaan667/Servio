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

  // Only these routes are public:
  const publicRoutes = ['/', '/sign-in', '/sign-up', '/order'];
  const isPublicRoute = pathname ? publicRoutes.some(route => pathname.startsWith(route)) : false;

  useEffect(() => {
    let ignore = false;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (ignore) return;
      setSession(session);
      setLoading(false);

      // If no session and not on a public page, redirect:
      if (!session && !isPublicRoute) {
        router.replace("/sign-in");
      }
    };

    checkSession();

    // Listen for changes:
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session && !isPublicRoute) {
        router.replace("/sign-in");
      }
    });
    return () => {
      ignore = true;
      subscription?.unsubscribe();
    };
  }, [router, pathname, isPublicRoute]);

  // Profile check
  useEffect(() => {
    if (!session?.user) return;
    let ignore = false;
    const checkProfile = async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_id", session.user.id)
        .maybeSingle();
      if (ignore) return;
      if (!data || error) {
        setProfileComplete(false);
        if (pathname !== '/complete-profile') {
          router.replace("/complete-profile");
        }
      } else {
        setProfileComplete(true);
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