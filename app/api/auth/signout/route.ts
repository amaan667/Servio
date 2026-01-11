import { createServerSupabase } from "@/lib/supabase";
import { isProduction } from "@/lib/env";
import { success, apiErrors } from "@/lib/api/standard-response";

export async function POST() {
  try {
    const supabase = await createServerSupabase();

    // SECURE: Use getUser() instead of getSession() for authentication check
    await supabase.auth.getUser();

    // Perform the signout
    const { error } = await supabase.auth.signOut();

    if (error) {
      
      return apiErrors.internal(error.message);
    }

    // Create a response that clears cookies
    const response = success({});

    // Explicitly clear auth cookies to ensure they're removed
    const authCookieNames = [
      "sb-access-token",
      "sb-refresh-token",
      "supabase.auth.token",
      "supabase-auth-token",
    ];

    authCookieNames.forEach((cookieName) => {
      response.cookies.set(cookieName, "", {

    return response;
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    
    return apiErrors.internal(errorMessage);
  }
}

// Also handle GET requests for compatibility
export async function GET() {
  return POST();
}
