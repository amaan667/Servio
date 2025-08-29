"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/auth/signin';

export default function SignInButton() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      await signInWithGoogle();
      // Redirect handled by OAuth callback
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleSignIn}
      disabled={loading}
      className="bg-servio-purple text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-servio-purple/90 transition-colors"
    >
      {loading ? 'Signing In...' : 'Sign In'}
    </Button>
  );
}