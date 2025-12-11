"use client";
import { useRouter } from "next/navigation";

export function GoogleSignInButton() {
  const router = useRouter();

  async function handleSignIn() {
    router.push("/sign-in");
  }

  return (
    <button
      onClick={handleSignIn}
      className="bg-white border border-gray-300 text-black hover:bg-gray-50 px-4 py-2 rounded-md font-medium"
    >
      Sign in with Google
    </button>
  );
}
