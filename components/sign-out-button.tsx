'use client';

import { useState } from 'react';
import { useAuthContext } from './auth-provider';

interface SignOutButtonProps {
  className?: string;
  children?: React.ReactNode;
  variant?: 'button' | 'link';
}

export function SignOutButton({ 
  className = '', 
  children = 'Sign Out',
  variant = 'button'
}: SignOutButtonProps) {
  const { signOut } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      console.log('[SIGN OUT BUTTON] Starting sign out');
      
      await signOut();
      
      console.log('[SIGN OUT BUTTON] Sign out completed');
    } catch (error) {
      console.error('[SIGN OUT BUTTON] Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'link') {
    return (
      <button
        onClick={handleSignOut}
        disabled={isLoading}
        className={`text-red-600 hover:text-red-800 disabled:opacity-50 ${className}`}
      >
        {isLoading ? 'Signing out...' : children}
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className={`bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-md transition-colors ${className}`}
    >
      {isLoading ? 'Signing out...' : children}
    </button>
  );
}