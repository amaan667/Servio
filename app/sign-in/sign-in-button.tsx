'use client';

import { useRouter } from 'next/navigation';
import { logInfo, logError } from "@/lib/logger";

export default function SignInButton() {
  const router = useRouter();
  
  const onGoogle = async () => {
    try {
      logInfo('[AUTH DEBUG] SignInButton: Redirecting to sign-in page');
      router.push('/sign-in');
    } catch (error) {
      logError('[AUTH DEBUG] SignInButton error:', error);
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
