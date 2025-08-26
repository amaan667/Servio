"use client";
import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

function SignInPageContent() {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signInWithGoogle() {
    try {
      setBusy(true); setErr(null);
      // Clear any stale PKCE artifacts to prevent verifier mismatch
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
        });
      } catch {}
      const origin = siteOrigin();
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          flowType: "pkce",
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? "Google sign-in failed");
      setBusy(false);
    }
  }

  async function onEmailSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setBusy(true); setErr(null);
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) router.replace("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Sign In</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        type="button" // IMPORTANT: not submitting the email form
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-md border px-3 py-2"
      >
        {busy ? "Redirecting…" : "Sign in with Google"}
      </button>

      <div className="text-center text-sm text-muted-foreground">OR CONTINUE WITH EMAIL</div>

      <form onSubmit={onEmailSignIn} className="space-y-3">
        <input
          type="email"
          className="w-full rounded-md border px-3 py-2"
          placeholder="Email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded-md border px-3 py-2"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full rounded-md bg-black text-white px-3 py-2" disabled={busy}>
          Sign in
        </button>
      </form>

      <p className="text-sm">
        New here? <a className="underline" href="/sign-up">Create an account</a>
      </p>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-md py-10 space-y-6">
        <h1 className="text-2xl font-semibold">Sign In</h1>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </main>
    }>
      <SignInPageContent />
    </Suspense>
  );
}
