// Debug endpoint to manually fix subscription tier
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tier } = body;

    if (!tier || !["basic", "standard", "premium"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier. Must be: basic, standard, or premium" },
        { status: 400 }
      );
    }

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Update the organization tier
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update({
        subscription_tier: tier,
        subscription_status: 'active', // Set to active instead of trialing
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating organization:', { error: updateError.message });
      return NextResponse.json(
        { error: "Failed to update organization", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated plan to ${tier}`,
      before: {
        tier: org.subscription_tier,
        status: org.subscription_status
      },
      after: {
        tier: updatedOrg.subscription_tier,
        status: updatedOrg.subscription_status
      },
      organization: updatedOrg
    });

  } catch (error: any) {
    logger.error('Fix subscription error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

