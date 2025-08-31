'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { redirect } from 'next/navigation';

interface AuthWrapperProps {
  children: ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    redirect('/sign-in');
  }

  return <>{children}</>;
}
