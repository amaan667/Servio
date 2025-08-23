'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

interface EnvironmentCheckProps {
  showDetails?: boolean;
}

export default function EnvironmentCheck({ showDetails = false }: EnvironmentCheckProps) {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(showDetails);

  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());
  }, []);

  if (isConfigured === null) {
    return null; // Still checking
  }

  if (isConfigured) {
    return null; // Everything is fine
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-medium">Authentication service not available</p>
          <p className="text-sm">
            The application cannot connect to the authentication service. This is usually due to missing environment variables.
          </p>
          
          {showFullDetails && (
            <div className="text-xs space-y-1 mt-2 p-2 bg-red-50 rounded border">
              <p><strong>Required Environment Variables:</strong></p>
              <p>• NEXT_PUBLIC_SUPABASE_URL</p>
              <p>• NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
              <p className="mt-2">
                <strong>For local development:</strong> Add these to your .env.local file
              </p>
              <p className="mt-2">
                <strong>For production:</strong> Set these in your deployment platform (Railway, Vercel, etc.)
              </p>
            </div>
          )}
          
          {!showFullDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullDetails(true)}
              className="mt-2"
            >
              Show Configuration Details
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}