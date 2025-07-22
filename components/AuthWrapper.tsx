"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    let ignore = false;
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }
    supabase?.auth.getUser().then(({ data: { user } }) => {
      if (ignore) return;
      setUser(user);
      cachedUser = user;
      if (!user) {
        setLoading(false);
        router.replace("/sign-in");
      }
    });
    const { data: listener } = supabase?.auth.onAuthStateChange?.((_event, session) => {
      setUser(session?.user || null);
      cachedUser = session?.user || null;
      if (!session?.user) {
        setLoading(false);
        router.replace("/sign-in");
      }
    }) || { data: { subscription: { unsubscribe: () => {} } } };
    return () => {
      ignore = true;
      listener?.subscription?.unsubscribe?.();
    };
  }, [router]);

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
      if (!ignore && (!data || error)) {
        setProfileComplete(false);
        cachedProfileComplete = false;
        router.replace("/complete-profile");
      } else {
        setProfileComplete(true);
        cachedProfileComplete = true;
        setLoading(false);
      }
    }
    checkProfile();
    return () => { ignore = true; };
  }, [user, router]);

  if (loading || profileComplete === false) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
    </div>
  );
  return <>{children}</>;
} 