"use client";

import { useFeatureAuth } from "../hooks/useFeatureAuth";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";

export default function AichatClientPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const { user, userRole, authError } = useFeatureAuth({
    venueId,
    featureName: "AI Assistant",
  });

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">{authError}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!user || !userRole) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={userRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Assistant</h1>
          <p className="text-lg text-foreground mt-2">Chat with your AI business assistant</p>
        </div>

        {/* Coming Soon Placeholder */}
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border-2 border-dashed border-purple-200 dark:border-purple-800">
          <MessageSquare className="w-16 h-16 text-purple-600 dark:text-purple-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            AI Assistant Coming Soon!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
            We&apos;re building an intelligent AI assistant to help you manage your business more
            efficiently. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  );
}
