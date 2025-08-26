import { supabase } from './supabase';

export async function clearAuthState() {
  try {
    // Clear localStorage
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || key.includes('sb-') || key.includes('pkce')
    );
    authKeys.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage
    const sessionKeys = Object.keys(sessionStorage).filter(key => 
      key.includes('supabase') || key.includes('sb-') || key.includes('pkce')
    );
    sessionKeys.forEach(key => sessionStorage.removeItem(key));

    // Sign out from Supabase
    await supabase().auth.signOut();
    
    console.log('[AUTH RECOVERY] Auth state cleared successfully');
  } catch (error) {
    console.error('[AUTH RECOVERY] Failed to clear auth state:', error);
  }
}

export async function retryAuthOperation<T>(
  operation: () => Promise<T>, 
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`[AUTH RECOVERY] Attempt ${i + 1} failed:`, error);
      
      if (i === maxRetries - 1) throw error;
      
      // Clear auth state between retries
      await clearAuthState();
      
      // Wait before retry with exponential backoff
      const delay = 1000 * Math.pow(2, i);
      console.log(`[AUTH RECOVERY] Waiting ${delay}ms before retry ${i + 2}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

export function isAuthError(error: any): boolean {
  const authErrorMessages = [
    'PKCEGrantParams',
    'auth_code',
    'invalid_grant',
    'expired_token',
    'invalid_token',
    'unauthorized'
  ];
  
  const errorMessage = error?.message?.toLowerCase() || '';
  return authErrorMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}