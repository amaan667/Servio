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
    // Log the error to help with debugging
    console.error('Application error:', error);
    
    // Only redirect to home for certain types of errors, not order-related ones
    if (error.message.includes('Cannot access uninitialized variable') || 
        error.message.includes('Missing Supabase environment variables')) {
      router.push('/');
    }
    // For other errors, don't redirect - let the component handle it
  }, [error, router]);

  // Return a simple loading state while redirecting
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-servio-purple mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
