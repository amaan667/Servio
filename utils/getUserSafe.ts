import { createClient } from '@/lib/supabase/server'
import { hasServerAuthCookie } from '@/lib/server-utils'

export async function getUserSafe(context?: string) {
  if (!(await hasServerAuthCookie())) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[AUTH GUARD] ${context ?? ''}: No auth cookie, skipping getUser()`)
    }
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error?.code === 'refresh_token_not_found') {
    console.warn(`[AUTH GUARD] ${context ?? ''}: Refresh token not found - this may indicate an OAuth issue`)
    
    // Try to refresh the session manually
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.error(`[AUTH GUARD] ${context ?? ''}: Session refresh failed:`, refreshError)
        return null
      }
      
      if (refreshData.session) {
        return refreshData.user
      }
    } catch (refreshErr) {
      console.error(`[AUTH GUARD] ${context ?? ''}: Session refresh error:`, refreshErr)
    }
    
    return null
  }

  if (error) {
    console.error(`[AUTH GUARD] ${context ?? ''}: getUser() error`, error)
    return null
  }

  return data.user ?? null
}
