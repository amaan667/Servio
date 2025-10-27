"use client";
import { createClient } from "@/lib/supabase";

export async function getPrimaryVenue() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return null;

  const { data: venueData, error } = await supabase
    .from("venues")
    .select("venue_id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !venueData?.length) return null;
  return venueData[0].venue_id as string;
}
