"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setBusy(true); setErr(null); setMsg(null);
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      // Depending on Supabase settings, user may need email confirmation
      setMsg("Check your email to confirm your account, then sign in.");
      // Optionally auto-navigate to sign-in
      // router.replace(`/sign-in?email=${encodeURIComponent(email)}`);
    } catch (e: any) {
      setErr(e?.message ?? "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Create Account</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <form onSubmit={onSubmit} className="space-y-3">
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
          {busy ? "Creating…" : "Sign up"}
        </button>
      </form>

      <p className="text-sm">
        Already have an account? <a className="underline" href="/sign-in">Sign in</a>
      </p>
    </main>
  );
}
