"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export default function SignInClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signInWithGoogle() {
    try {
      setBusy(true);
      setErr(null);
      const redirectTo = `${getSiteUrl()}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      // Supabase will redirect to Google's consent → back to /auth/callback
    } catch (e: any) {
      setErr(e?.message ?? "Sign-in failed");
      setBusy(false);
    }
  }

  async function onSubmitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // Prevent page refresh
    try {
      setBusy(true);
      setErr(null);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) router.replace("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Authentication error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <button type="button" onClick={signInWithGoogle} disabled={busy} className="w-full">
        {busy ? "Redirecting…" : "Sign in with Google"}
      </button>

      <div className="text-center text-sm text-muted-foreground">OR CONTINUE WITH EMAIL</div>

      <form onSubmit={onSubmitEmail} className="space-y-3">
        <input type="email" className="w-full" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="w-full" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={busy} className="w-full">Sign in</button>
      </form>
    </div>
  );
}
