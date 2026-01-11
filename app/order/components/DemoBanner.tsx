"use client";

import { Button } from "@/components/ui/button";

interface DemoBannerProps {

}

export function DemoBanner({ isDemo, onResetCart }: DemoBannerProps) {
  if (!isDemo) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 px-4 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">
            💡 Demo Mode Active — Experience full ordering flow with payment simulation
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onResetCart}
          className="text-white border-white/30 hover:bg-white/20 text-xs hidden sm:flex"
        >
          Reset Cart
        </Button>
      </div>
    </div>
  );
}
