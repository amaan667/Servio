'use client';
import { useEffect, useState } from 'react';

interface HealthCheckProps {
  onHealthStatus?: (status: HealthStatus) => void;
}

interface HealthStatus {
  supabase: boolean;
  environment: boolean;
  timestamp: string;
  errors: string[];
}

export default function HealthCheck({ onHealthStatus }: HealthCheckProps) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const checkHealth = () => {
      const errors: string[] = [];
      let supabaseHealthy = true;
      let environmentHealthy = true;

      // Check environment variables
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        errors.push('Missing NEXT_PUBLIC_SUPABASE_URL');
        environmentHealthy = false;
      }

      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        errors.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
        environmentHealthy = false;
      }

      // Check Supabase URL format
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        try {
          new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
        } catch {
          errors.push('Invalid NEXT_PUBLIC_SUPABASE_URL format');
          environmentHealthy = false;
        }
      }

      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        errors.push('Not in browser environment');
        supabaseHealthy = false;
      }

      const status: HealthStatus = {
        supabase: supabaseHealthy,
        environment: environmentHealthy,
        timestamp: new Date().toISOString(),
        errors
      };

      setHealthStatus(status);
      
      if (onHealthStatus) {
        onHealthStatus(status);
      }

      // Log health status
      if (errors.length > 0) {
        console.error('[HEALTH-CHECK] Issues found:', errors);
      } else {
        console.log('[HEALTH-CHECK] All systems healthy');
      }
    };

    checkHealth();
  }, [onHealthStatus]);

  // Don't render anything in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  if (!healthStatus) {
    return null;
  }

  const hasIssues = healthStatus.errors.length > 0;

  return (
    <div className={`fixed bottom-4 right-4 p-3 rounded-lg text-xs z-50 ${
      hasIssues ? 'bg-red-100 border border-red-300 text-red-800' : 'bg-green-100 border border-green-300 text-green-800'
    }`}>
      <div className="font-semibold mb-1">
        {hasIssues ? '⚠️ Health Issues' : '✅ Healthy'}
      </div>
      {hasIssues && (
        <ul className="list-disc list-inside space-y-1">
          {healthStatus.errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
      <div className="text-xs opacity-75 mt-2">
        {healthStatus.timestamp}
      </div>
    </div>
  );
}