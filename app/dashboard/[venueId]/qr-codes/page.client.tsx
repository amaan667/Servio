"use client";

import { useRouter } from "next/navigation";
import QRCodeClient from "./QRCodeClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { usePageAuth } from "../hooks/usePageAuth";

export default function QRCodeClientPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const { user, userRole, venueName, authError } = usePageAuth({
    venueId,
    pageName: "QR Codes",
  });

  // No loading spinner - render immediately
  if (authError) {
    console.error("[QR CODES PAGE] ❌ Auth error:", authError);
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

  // Render immediately even if user is not loaded yet
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {user && userRole && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole as unknown}
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QR Code Generator</h1>
          <p className="text-lg text-foreground mt-2">
            Generate and manage QR codes for your tables and counters
          </p>
        </div>

        {user && venueName ? (
          <QRCodeClient venueId={venueId} venueName={venueName} />
        ) : (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        )}
      </div>
    </div>
  );
}
