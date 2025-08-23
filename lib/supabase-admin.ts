import { createClient } from "@supabase/supabase-js";

// Environment variables for admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing Supabase admin environment variables:", {
    NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey
  });
  throw new Error("Missing Supabase admin configuration. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

// Create admin client with service role key for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

console.log("Supabase admin client created successfully");

// Export a function to get the admin client (for backward compatibility)
export function createAdminClient() {
  return supabaseAdmin;
}