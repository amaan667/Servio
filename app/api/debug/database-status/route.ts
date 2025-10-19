import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiLogger as logger } from '@/lib/logger';

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
      logger.debug('organizations table check failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    try {
      const { data: uvr } = await supabase
        .from('user_venue_roles')
        .select('count')
        .limit(1);
      checks.user_venue_roles = true;
    } catch (error) {
      logger.debug('user_venue_roles table check failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    try {
      const { data: venues } = await supabase
        .from('venues')
        .select('count')
        .limit(1);
      checks.venues = true;
    } catch (error) {
      logger.debug('venues table check failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return NextResponse.json({
      success: true,
      tables: checks,
      message: 'Database status check complete'
    });

  } catch (error) {
    logger.error('Database status check error:', { error: error instanceof Error ? error.message : 'Unknown error' });
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
