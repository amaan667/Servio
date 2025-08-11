"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const didRedirectRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!didRedirectRef.current) {
        console.warn("[CALLBACK] timeout fallback -> /complete-profile");
        didRedirectRef.current = true;
        router.replace("/complete-profile");
      }
    }, 4000);

    const completeSignIn = async () => {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/dashboard";
      console.log("[CALLBACK] starting", { codePresent: !!code, next });
      if (!code) {
        setError("Missing authorization code");
        didRedirectRef.current = true;
        router.replace("/auth/auth-code-error");
        return;
      }

      try {
        console.log("[CALLBACK] exchanging code...");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[CALLBACK] exchange error", error);
          setError(error.message || "Failed to exchange code");
          didRedirectRef.current = true;
          router.replace("/auth/auth-code-error");
          return;
        }
        console.log("[CALLBACK] exchange success, fetching user...");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn("[CALLBACK] no user after exchange");
          didRedirectRef.current = true;
          router.replace("/sign-in");
          return;
        }
        console.log("[CALLBACK] user", user.id);

        const { data: venue, error: venueErr } = await supabase
          .from("venues")
          .select("venue_id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (venueErr) console.warn("[CALLBACK] venue query error", venueErr);

        if (!venue) {
          console.log("[CALLBACK] no venue -> /complete-profile");
          didRedirectRef.current = true;
          router.replace("/complete-profile");
        } else {
          console.log("[CALLBACK] venue exists ->", next);
          didRedirectRef.current = true;
          router.replace(next);
        }
      } catch (e: any) {
        console.error("[CALLBACK] unexpected", e);
        setError(e?.message || "Unexpected error during sign-in");
        didRedirectRef.current = true;
        router.replace("/auth/auth-code-error");
      } finally {
        clearTimeout(timeout);
      }
    };

    completeSignIn();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center text-gray-600">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple mx-auto mb-3" />
        {error ? "Finishing sign-in…" : "Finishing sign-in…"}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-servio-purple" />
      </div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
