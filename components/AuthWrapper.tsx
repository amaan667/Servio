"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    let ignore = false;
    supabase?.auth.getUser().then(({ data: { user } }) => {
      if (ignore) return;
      setUser(user);
      if (!user) {
        setLoading(false);
        router.replace("/sign-in");
      }
    });
    const { data: listener } = supabase?.auth.onAuthStateChange?.((_event, session) => {
      setUser(session?.user || null);
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
        router.replace("/complete-profile");
      } else {
        setProfileComplete(true);
        setLoading(false);
      }
    }
    checkProfile();
    return () => { ignore = true; };
  }, [user, router]);

  if (loading || profileComplete === false) return <div>Loading...</div>;
  return <>{children}</>;
} 