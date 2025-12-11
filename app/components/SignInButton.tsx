"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SignInButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async () => {
    if (loading) return;

    setLoading(true);
    try {
      router.push("/sign-in");
    } catch (_error) {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleSignIn}
      disabled={loading}
      className="bg-servio-purple text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-servio-purple/90 transition-colors"
    >
      {loading ? "Loading..." : "Sign In"}
    </Button>
  );
}
