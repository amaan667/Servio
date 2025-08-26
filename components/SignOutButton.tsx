"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const sb = createClient();
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await sb.auth.signOut();
        router.replace("/sign-in");
      }}
      className="rounded-md border px-3 py-2"
    >
      Sign out
    </button>
  );
}
