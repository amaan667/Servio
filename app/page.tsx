import { createServerSupabase } from "@/lib/supabase";
import { HomePageClient } from "./HomePageClient";

export default async function HomePage() {
  // Get auth state on server to prevent flicker
  let isSignedIn = false;
  try {
    const supabase = await createServerSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    isSignedIn = !!session?.user;
  } catch {
    // If error, default to not signed in
    isSignedIn = false;
  }

  return <HomePageClient initialAuthState={isSignedIn} />;
}
