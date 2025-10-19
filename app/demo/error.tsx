'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
    // Log error for debugging but don't crash the app
    console.warn('[DEMO PAGE] Recovering from error:', error.message);
    
    // Auto-redirect to home page after a short delay to prevent users from getting stuck
    const timeout = setTimeout(() => {
      router.push('/');
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [error, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="text-purple-500 text-5xl mb-4">🔄</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Demo...</h2>
          <p className="text-gray-600 mb-6">
            We're preparing the demo experience for you. If this takes too long, try one of the options below.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              Go to Home
            </Button>
            <Button
              onClick={reset}
              variant="outline"
              className="w-full"
            >
              Retry Demo
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Redirecting to home page in 5 seconds...
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-4 bg-gray-100 rounded text-left">
              <p className="text-xs text-gray-700 font-mono break-words">
                {error.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}