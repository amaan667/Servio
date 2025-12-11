"use client";

import { useRouter } from "next/navigation";

export default function SignInButton() {
  const router = useRouter();

  const onGoogle = async () => {
    try {
      router.push("/sign-in");
    } catch (_error) {
      // Error silently handled
    }
  };

  return (
    <button
      type="button"
      onClick={onGoogle}
      className="px-4 py-2 rounded bg-white border border-gray-300 text-black hover:bg-gray-50 font-medium"
    >
      Sign in with Google
    </button>
  );
}
