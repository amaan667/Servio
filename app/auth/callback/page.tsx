"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams?.get("code");

  useEffect(() => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "<no-window>";
    console.log("[AUTH DEBUG] /auth/callback mounted", {
      currentUrl,
      hasCode: Boolean(code),
    });

    if (!code) {
      console.log("[AUTH DEBUG] /auth/callback: no code found, redirecting to /sign-in?error=no_code");
      router.replace("/sign-in?error=no_code");
      return;
    }

    const handleUrl = `/auth/callback/handle?code=${encodeURIComponent(code)}`;
    console.log("[AUTH DEBUG] /auth/callback: forwarding to server handler", { handleUrl });
    // Redirect to our server-side handler
    router.replace(handleUrl);
  }, [code, router]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Finishing sign in…</h1>
      <p>Please wait while we log you in.</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}