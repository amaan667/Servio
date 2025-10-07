'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DEMO PAGE ERROR]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">An unexpected error occurred. Please try again.</p>
          <div className="space-y-3">
            <Button
              onClick={reset}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              Try Again
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
              className="w-full"
            >
              Go to Home
            </Button>
          </div>
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