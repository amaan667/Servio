/**
 * @fileoverview Safely get authenticated user without throwing errors
 * @module utils/getUserSafe
 */

import { createClient } from '@/lib/supabase'
import { hasServerAuthCookie } from '@/lib/server-utils'

/**
 * Safely retrieves the currently authenticated user
 * Returns null instead of throwing errors for unauthenticated requests
 * 
 * @returns {Promise<User | null>} The authenticated user or null
 * 
 * @example
 * ```ts
 * const user = await getUserSafe();
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * ```
 */
export async function getUserSafe() {
  if (!(await hasServerAuthCookie())) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    return null
  }

  return data.session?.user ?? null
}
