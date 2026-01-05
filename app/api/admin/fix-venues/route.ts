import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function POST() {
  try {
    console.log("[FIX VENUES] Starting venue fix process...");

    const supabase = await createServerSupabase();

    // Step 1: Find all venue_ids in user_venue_roles that don't exist in venues
    const { data: missingRoles, error: rolesError } = await supabase
      .from('user_venue_roles')
      .select('venue_id, user_id, role')
      .order('created_at');

    if (rolesError) {
      console.error("[FIX VENUES] Error fetching roles:", rolesError);
      return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }

    // Step 2: Check which venues are missing
    const venueChecks = await Promise.all(
      missingRoles.map(async (role) => {
        const { data: venue, error } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('venue_id', role.venue_id)
          .single();

        return {
          venue_id: role.venue_id,
          user_id: role.user_id,
          role: role.role,
          exists: !error && !!venue,
          venue_data: venue
        };
      })
    );

    const missingVenues = venueChecks.filter(check => !check.exists);

    console.log("[FIX VENUES] Found missing venues:", missingVenues.length);

    // Step 3: Recreate missing venues
    const fixResults = [];

    for (const missing of missingVenues) {
      try {
        // Get user's organization
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('id, subscription_tier, subscription_status')
          .eq('owner_user_id', missing.user_id)
          .single();

        if (orgError || !org) {
          console.warn(`[FIX VENUES] No organization found for user ${missing.user_id}`);
          fixResults.push({
            venue_id: missing.venue_id,
            status: 'skipped',
            reason: 'No organization found'
          });
          continue;
        }

        // Create the venue
        const { data: newVenue, error: insertError } = await supabase
          .from('venues')
          .insert({
            venue_id: missing.venue_id,
            venue_name: `${missing.user_id.slice(0, 8)}'s Venue`,
            business_type: 'Restaurant',
            owner_user_id: missing.user_id,
            organization_id: org.id,
            is_active: true,
            timezone: 'Europe/London',
            currency: 'GBP',
            daily_reset_time: '06:00:00'
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[FIX VENUES] Failed to create venue ${missing.venue_id}:`, insertError);
          fixResults.push({
            venue_id: missing.venue_id,
            status: 'failed',
            error: insertError.message
          });
        } else {
          console.log(`[FIX VENUES] Successfully created venue ${missing.venue_id}`);
          fixResults.push({
            venue_id: missing.venue_id,
            status: 'created',
            venue: newVenue
          });
        }
      } catch (error) {
        console.error(`[FIX VENUES] Unexpected error for ${missing.venue_id}:`, error);
        fixResults.push({
          venue_id: missing.venue_id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Step 4: Verify the fixes worked
    const finalChecks = await Promise.all(
      missingVenues.map(async (missing) => {
        const { data: venue, error } = await supabase
          .from('venues')
          .select('venue_id, venue_name, owner_user_id, organization_id')
          .eq('venue_id', missing.venue_id)
          .single();

        // Test RPC
        const { data: rpcResult, error: rpcError } = await supabase.rpc('get_access_context', {
          p_venue_id: missing.venue_id
        });

        return {
          venue_id: missing.venue_id,
          venue_exists: !error && !!venue,
          rpc_works: !rpcError && !!rpcResult,
          rpc_result: rpcResult,
          venue_data: venue
        };
      })
    );

    return NextResponse.json({
      success: true,
      analysis: {
        total_roles: missingRoles.length,
        missing_venues: missingVenues.length,
        venue_checks: venueChecks
      },
      fixes: {
        attempted: fixResults.length,
        results: fixResults
      },
      verification: {
        final_checks: finalChecks
      }
    });

  } catch (error) {
    console.error("[FIX VENUES] Unexpected error:", error);
    return NextResponse.json({
      error: "Fix venues operation failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
