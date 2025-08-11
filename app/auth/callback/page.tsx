"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeSignIn = async () => {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/dashboard";
      if (!code) {
        setError("Missing authorization code");
        router.replace("/auth/auth-code-error");
        return;
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message || "Failed to exchange code");
          router.replace("/auth/auth-code-error");
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/sign-in");
          return;
        }

        const { data: venue } = await supabase
          .from("venues")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!venue) {
          router.replace("/complete-profile");
        } else {
          router.replace(next);
        }
      } catch (e: any) {
        setError(e?.message || "Unexpected error during sign-in");
        router.replace("/auth/auth-code-error");
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
