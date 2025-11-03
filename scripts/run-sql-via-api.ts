#!/usr/bin/env tsx
/**
 * Run SQL via Supabase HTTP API
 * This uses the Supabase query endpoint to execute raw SQL
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sql = `
-- Drop the function if it exists (in case it was created incorrectly)
DROP FUNCTION IF EXISTS get_invitation_by_token(TEXT);

-- Create the function to get invitation details by token
-- This function joins with auth.users to get the inviter's name and email
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  venue_id TEXT,
  organization_id UUID,
  invited_by UUID,
  invited_by_name TEXT,
  invited_by_email TEXT,
  email TEXT,
  role TEXT,
  permissions JSONB,
  status TEXT,
  token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  user_id UUID,
  venue_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.id,
    si.venue_id,
    si.organization_id,
    si.invited_by,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.email,
      'Unknown'
    ) AS invited_by_name,
    u.email AS invited_by_email,
    si.email,
    si.role,
    si.permissions,
    si.status,
    si.token,
    si.expires_at,
    si.created_at,
    si.updated_at,
    si.accepted_at,
    si.user_id,
    v.venue_name
  FROM staff_invitations si
  LEFT JOIN auth.users u ON si.invited_by = u.id
  LEFT JOIN venues v ON si.venue_id = v.venue_id
  WHERE si.token = p_token;
END;
$$;
`;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase credentials");
    process.exit(1);
  }

  console.log(
    "📍 Go to: " +
      SUPABASE_URL.replace("https://", "https://supabase.com/dashboard/project/")
        .split(".")[0]
        .replace("supabase.com/dashboard/project/", "") +
      " → SQL Editor\n"
  );
}

main();
