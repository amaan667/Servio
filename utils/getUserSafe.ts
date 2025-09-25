import { createClient } from '@/lib/supabase/server'
import { hasSbAuthCookie } from './hasSbAuthCookie'
import { logInfo, logWarn, logError } from "@/lib/logger";

export async function getUserSafe(context?: string) {
  if (!(await hasSbAuthCookie())) {
    if (process.env.NODE_ENV !== 'production') {
      logWarn(`[AUTH GUARD] ${context ?? ''}: No auth cookie, skipping getUser()`)
    }
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error?.code === 'refresh_token_not_found') {
    logWarn(`[AUTH GUARD] ${context ?? ''}: Refresh token not found - this may indicate an OAuth issue`)
    
    // Try to refresh the session manually
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        logError(`[AUTH GUARD] ${context ?? ''}: Session refresh failed:`, refreshError)
        return null
      }
      
      if (refreshData.session) {
        logInfo(`[AUTH GUARD] ${context ?? ''}: Session refreshed successfully`)
        return refreshData.user
      }
    } catch (refreshErr) {
      logError(`[AUTH GUARD] ${context ?? ''}: Session refresh error:`, refreshErr)
    }
    
    return null
  }

  if (error) {
    logError(`[AUTH GUARD] ${context ?? ''}: getUser() error`, error)
    return null
  }

  return data.user ?? null
}
