'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function CreateAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createAccount = async () => {
      try {
        // Get signup data from localStorage
        const signupDataStr = localStorage.getItem('signup_data');
        if (!signupDataStr) {
          setError('No signup data found. Please start over.');
          setStatus('error');
          return;
        }

        const signupData = JSON.parse(signupDataStr);

        // Call the signup API
        const response = await fetch('/api/signup/with-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signupData),
        });

        const data = await response.json();

        if (data.error || !data.success) {
          setError(data.error || 'Failed to create account. Please try again.');
          setStatus('error');
          return;
        }

        // Clear signup data
        localStorage.removeItem('signup_data');

        // Redirect to dashboard
        setStatus('success');
        setTimeout(() => {
          router.push(`/dashboard/${data.venueId}?welcome=true`);
        }, 2000);
      } catch (err: any) {
        console.error('Account creation error:', err);
        setError(err.message || 'Failed to create account. Please try again.');
        setStatus('error');
      }
    };

    createAccount();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Creating Your Account</CardTitle>
          <CardDescription>Setting up your Servio account...</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-gray-600">Please wait while we create your account...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-600 mb-4">Account created successfully!</p>
              <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => router.push('/sign-up')}
                className="text-purple-600 hover:underline"
              >
                Go back to sign up
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

