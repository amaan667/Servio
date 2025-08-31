'use client';

import { useRouter } from 'next/navigation';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const router = useRouter();
  
  const signInWithGoogle = async () => {
    console.log('[AUTH DEBUG] SignUpPage: Redirecting to sign-in page');
    router.push('/sign-in');
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
