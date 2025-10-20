import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { apiLogger as logger } from '@/lib/logger';
import { withErrorHandling } from '@/lib/api/withErrorHandling';

export const GET = withErrorHandling(async () => {
  const supabase = await createClient();
  const checks = { organizations: false, user_venue_roles: false, venues: false };
  try {
    await supabase.from('organizations').select('count').limit(1);
    checks.organizations = true;
  } catch {}
  try {
    await supabase.from('user_venue_roles').select('count').limit(1);
    checks.user_venue_roles = true;
  } catch {}
  try {
    await supabase.from('venues').select('count').limit(1);
    checks.venues = true;
  } catch {}
  return { tables: checks, message: 'Database status check complete' };
});
