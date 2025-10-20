// Debug endpoint to check organization subscription status
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (orgError) {
      return NextResponse.json(
        { 
          error: "Failed to fetch organization", 
          details: orgError.message,
          user_id: user.id
        },
        { status: 500 }
      );
    }

    if (!org) {
      return NextResponse.json(
        { 
          error: "No organization found",
          user_id: user.id,
          suggestion: "Call /api/organization/ensure to create one"
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: user.id,
      user_email: user.email,
      organization: {
        id: org.id,
        name: org.name,
        subscription_tier: org.subscription_tier,
        subscription_status: org.subscription_status,
        stripe_customer_id: org.stripe_customer_id,
        stripe_subscription_id: org.stripe_subscription_id,
        trial_ends_at: org.trial_ends_at,
        is_grandfathered: org.is_grandfathered,
        created_at: org.created_at,
        updated_at: org.updated_at
      }
    });

  } catch (error: any) {
    logger.error('Check organization error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

