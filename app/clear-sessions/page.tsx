'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearInvalidSession } from '@/lib/supabaseClient';

export default function ClearSessionsPage() {
  const router = useRouter();

  useEffect(() => {
    const clearSessions = async () => {
      try {
        console.log('[CLEAR_SESSIONS] Clearing all sessions...');
        
        // Clear client-side sessions
        await clearInvalidSession();
        
        // Clear any additional localStorage items
        if (typeof window !== 'undefined') {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('auth') || key.includes('session'))) {
              keysToRemove.push(key);
            }
          }
          
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('[CLEAR_SESSIONS] Removed:', key);
          });
        }
        
        console.log('[CLEAR_SESSIONS] Sessions cleared successfully');
        
        // Redirect to sign-in page
        router.replace('/sign-in?message=sessions_cleared');
      } catch (error) {
        console.error('[CLEAR_SESSIONS] Error clearing sessions:', error);
        router.replace('/sign-in?error=clear_failed');
      }
    };

    clearSessions();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-600">Clearing sessions...</p>
      </div>
    </div>
  );
}