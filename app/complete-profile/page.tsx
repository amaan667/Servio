"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// THIS PAGE IS DISABLED - New flow: Select Plan → Stripe → Sign Up
// Google OAuth users and all users now follow the same flow
// Redirects to select-plan page

export default function CompleteProfilePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect immediately to select-plan
    router.replace("/select-plan");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
    </div>
  );
}
