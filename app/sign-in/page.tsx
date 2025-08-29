"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/auth/signin";

export default function DeprecatedSignInRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Immediately start OAuth; this page exists only for backward links
    signInWithGoogle().catch(() => {
      // If initiation fails, go home where the Sign In button exists
      router.replace(`/`);
    });
  }, [router]);

  return (
    <main className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold mb-3">Redirecting…</h1>
      <p className="text-gray-600">Starting Google sign-in.</p>
    </main>
  );
}
