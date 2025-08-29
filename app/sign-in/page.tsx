"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle } from "@/lib/auth/signin";

function SignInContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);
  const err = sp.get("error");

  async function handleGoogle() {
    try {
      setLoading(true);
      await signInWithGoogle(); // redirects to Google
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md py-16">
      <h1 className="text-2xl font-semibold mb-6">Sign In</h1>

      {err && (
        <p className="mb-4 text-sm text-red-600">
          {err === "timeout" && "Authentication timed out. Please try again."}
          {err === "oauth_error" && "Authentication failed. Please try again."}
          {err === "exchange_failed" && "Sign-in failed while finalizing session."}
          {err === "missing_code" && "Missing authorization code in callback."}
          {err === "no_session" && "Signed in, but no session returned."}
          {["timeout","oauth_error","exchange_failed","missing_code","no_session"].includes(err) ? "" : err}
        </p>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Sign in with Google"}
      </button>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-md py-16">
        <h1 className="text-2xl font-semibold mb-6">Sign In</h1>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded-md mb-4"></div>
        </div>
      </main>
    }>
      <SignInContent />
    </Suspense>
  );
}
