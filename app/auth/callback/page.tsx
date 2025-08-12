"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  useEffect(() => {
    if (!code) {
      router.replace("/sign-in?error=no_code");
      return;
    }
    // Redirect to our server-side handler
    router.replace(`/auth/callback/handle?code=${encodeURIComponent(code)}`);
  }, [code, router]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Finishing sign in…</h1>
      <p>Please wait while we log you in.</p>
    </div>
  );
}