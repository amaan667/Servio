import { createClient } from "@supabase/supabase-js";

// Environment variables for admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: ReturnType<typeof createClient> | null = null;

function ensureAdminClient() {
  if (adminClient) return adminClient;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }
  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return adminClient;
}

export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    const client = ensureAdminClient() as any;
    return client[prop as any];
  }
}) as unknown as ReturnType<typeof createClient>;

export function createAdminClient() {
  return ensureAdminClient();
}