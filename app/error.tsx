'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Don't handle NEXT_REDIRECT errors - these are internal Next.js redirect mechanisms
    if (error.message === 'NEXT_REDIRECT' || error.name === 'NEXT_REDIRECT') {
      console.log('[ERROR BOUNDARY] Ignoring NEXT_REDIRECT error - this is expected behavior');
      return;
    }
    
    // Log the error to help with debugging
    console.error('[ERROR BOUNDARY] Application error caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    });
    
    // Only redirect to home for certain types of errors, not order-related ones
    if (error.message.includes('Cannot access uninitialized variable') || 
        error.message.includes('Missing Supabase environment variables')) {
      console.log('[ERROR BOUNDARY] Redirecting to home due to error type');
      router.push('/');
    }
    // For other errors, don't redirect - let the component handle it
  }, [error, router]);

  // Don't render error UI for NEXT_REDIRECT errors
  if (error.message === 'NEXT_REDIRECT' || error.name === 'NEXT_REDIRECT') {
    return null;
  }

  // Return a simple error state with reset option
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-4">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={() => {
            console.log('[ERROR BOUNDARY] Reset button clicked', {
              timestamp: new Date().toISOString(),
            });
            reset();
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
