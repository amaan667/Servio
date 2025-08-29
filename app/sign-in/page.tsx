"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithGoogle } from "@/lib/auth/signin";

function SignInContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const err = sp.get("error");

  console.log('[AUTH DEBUG] SignInContent: Component rendered with:', {
    hasError: !!err,
    error: err,
    loading,
    timestamp: new Date().toISOString()
  });

  async function handleGoogle() {
    try {
      console.log('[AUTH DEBUG] SignInContent: Google sign-in button clicked');
      setLoading(true);
      setError(null);
      console.log('[AUTH DEBUG] SignInContent: Starting Google OAuth sign-in...');
      await signInWithGoogle(); // redirects to Google
    } catch (err: any) {
      console.error('[AUTH DEBUG] SignInContent: Google OAuth sign-in failed:', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      setError(err.message || 'Failed to start Google sign-in');
    } finally {
      console.log('[AUTH DEBUG] SignInContent: Google sign-in attempt finished');
      setLoading(false);
    }
  }

  // Show error from URL params or local state
  const displayError = error || err;

  return (
    <main className="mx-auto max-w-md py-16">
      <h1 className="text-2xl font-semibold mb-6">Sign In</h1>

      {displayError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">
            {displayError === "timeout" && "Authentication timed out. Please try again."}
            {displayError === "oauth_error" && "Authentication failed. Please try again."}
            {displayError === "exchange_failed" && "Sign-in failed while finalizing session."}
            {displayError === "missing_code" && "Missing authorization code in callback. Please try again."}
            {displayError === "pkce_error" && "Authentication flow error. Please try again."}
            {displayError === "no_session" && "Signed in, but no session returned."}
            {!["timeout","oauth_error","exchange_failed","missing_code","pkce_error","no_session"].includes(displayError) && displayError}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-60 hover:bg-indigo-700 transition-colors"
      >
        {loading ? "Redirecting to Google…" : "Sign in with Google"}
      </button>
      
      {displayError && (
        <button
          type="button"
          onClick={() => {
            console.log('[AUTH DEBUG] SignInContent: Clearing error and retrying');
            setError(null);
            router.replace('/sign-in');
          }}
          className="w-full mt-2 rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Clear Error & Try Again
        </button>
      )}

      {/* Debug Link */}
      <div className="mt-8 text-center">
        <a
          href="/debug-auth"
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Debug Authentication
        </a>
      </div>
    </main>
  );
}

export default function SignInPage() {
  console.log('[AUTH DEBUG] SignInPage: Page component rendered');
  
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
