'use client';

import { useState } from 'react';
import { supabase } from '@/lib/sb-client';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    // This function is no longer used - OAuth is handled directly in the form
    console.log('[AUTH] signInWithGoogle called but not used');
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} loading={loading} />;
}
