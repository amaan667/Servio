'use client'
import { useRouter } from 'next/navigation'

export function GoogleSignInButton() {
  const router = useRouter();

  async function handleSignIn() {
    router.push('/sign-in');
  }

  return <button onClick={handleSignIn}>Sign in with Google</button>
}
