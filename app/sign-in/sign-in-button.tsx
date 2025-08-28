'use client';

import { signInWithGoogle } from '@/lib/auth/signin';

export default function SignInButton() {
  
  const onGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('[AUTH DEBUG] OAuth error:', error);
    }
  };

  return (
    <button 
      type="button"
      onClick={onGoogle} 
      className="px-4 py-2 rounded bg-black text-white"
    >
      Sign in with Google
    </button>
  );
}
