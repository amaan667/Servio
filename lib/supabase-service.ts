import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabaseClient: SupabaseClient | null = null;

/**
 * Creates a Supabase service client with proper error handling
 * This is used for server-side operations that require elevated permissions
 */
export function createSupabaseServiceClient(): SupabaseClient {
  // Return cached client if available
  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }

  console.log('🔄 Creating Supabase service client...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    const error = 'NEXT_PUBLIC_SUPABASE_URL is required for Supabase service client';
    console.error('❌ Supabase service client creation failed:', error);
    throw new Error(error);
  }

  if (!supabaseServiceKey) {
    const error = 'SUPABASE_SERVICE_ROLE_KEY is required for Supabase service client';
    console.error('❌ Supabase service client creation failed:', error);
    throw new Error(error);
  }

  try {
    cachedSupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ Supabase service client created successfully');
    return cachedSupabaseClient;
  } catch (error) {
    console.error('💥 Failed to create Supabase service client:', error);
    throw error;
  }
}

/**
 * Gets the Supabase service client, creating it if necessary
 */
export function getSupabaseServiceClient(): SupabaseClient {
  return createSupabaseServiceClient();
}