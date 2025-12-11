"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <WifiOff className="h-16 w-16 mx-auto mb-4 text-gray-400" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Offline</h1>
        <p className="text-gray-600 mb-6">
          It looks like you've lost your internet connection. Some features may not be available.
        </p>
        <div className="space-y-3">
          <Button onClick={() => window.location.reload()} className="w-full" variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Link href="/">
            <Button variant="outline" className="w-full">
              Go to Home
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-6">
          Your queued operations will sync automatically when you're back online.
        </p>
      </div>
    </div>
  );
}
