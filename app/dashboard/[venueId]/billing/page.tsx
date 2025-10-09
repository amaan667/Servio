import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import BillingClient from "./billing-client";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;

  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get venue and organization
  const { data: venue } = await supabase
    .from("venues")
    .select("*, organizations(*)")
    .eq("venue_id", venueId)
    .single();

  if (!venue) {
    redirect("/dashboard");
  }

  // Get usage stats
  const [menuItems, tables, staff, venues] = await Promise.all([
    supabase.from("menu_items").select("id", { count: "exact" }).eq("venue_id", venueId),
    supabase.from("tables").select("id", { count: "exact" }).eq("venue_id", venueId),
    supabase.from("staff").select("id", { count: "exact" }).eq("venue_id", venueId),
    supabase
      .from("venues")
      .select("id", { count: "exact" })
      .eq("organization_id", venue.organization_id),
  ]);

  const usage = {
    menuItems: menuItems.count || 0,
    tables: tables.count || 0,
    staff: staff.count || 0,
    venues: venues.count || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueName={venue.name} currentPage="Billing" />
        
        <BillingClient
          venueId={venueId}
          venueName={venue.name}
          organization={venue.organizations}
          usage={usage}
        />
      </div>
    </div>
  );
}

