'use client'
import { useRouter } from 'next/navigation'
import { logInfo } from "@/lib/logger";

export function GoogleSignInButton() {
  const router = useRouter();

  async function handleSignIn() {
    logInfo('[AUTH DEBUG] GoogleSignInButton: Redirecting to sign-in page');
    router.push('/sign-in');
  }

  return <button onClick={handleSignIn}>Sign in with Google</button>
}
