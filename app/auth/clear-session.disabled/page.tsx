"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ClearSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams?.get('redirect') || '/sign-in?signedOut=true';

  useEffect(() => {
    console.log('[AUTH] Clearing client-side storage');
    // Clear all client-side storage
    if (typeof window !== 'undefined') {
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear any Supabase-related items specifically
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Also clear any remaining Supabase items that might have been added after clear()
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('[AUTH] Cleared all client-side storage');
    }

    // Redirect after a brief delay to ensure storage is cleared
    setTimeout(() => {
      console.log('[AUTH] Redirecting to', redirectTo);
      router.replace(redirectTo);
    }, 100);
  }, [redirectTo, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Signing out...</p>
      </div>
    </div>
  );
}

export default function ClearSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ClearSessionContent />
    </Suspense>
  );
}
