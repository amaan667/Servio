import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Check if tables exist
    const checks = {
      organizations: false,
      user_venue_roles: false,
      venues: false,
    };

    try {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('count')
        .limit(1);
      checks.organizations = true;
    } catch (error) {
      console.log('organizations table check failed:', error);
    }

    try {
      const { data: uvr } = await supabase
        .from('user_venue_roles')
        .select('count')
        .limit(1);
      checks.user_venue_roles = true;
    } catch (error) {
      console.log('user_venue_roles table check failed:', error);
    }

    try {
      const { data: venues } = await supabase
        .from('venues')
        .select('count')
        .limit(1);
      checks.venues = true;
    } catch (error) {
      console.log('venues table check failed:', error);
    }

    return NextResponse.json({
      success: true,
      tables: checks,
      message: 'Database status check complete'
    });

  } catch (error) {
    console.error('Database status check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tables: {
        organizations: false,
        user_venue_roles: false,
        venues: false,
      }
    }, { status: 500 });
  }
}
