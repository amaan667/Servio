"use client";

import React from "react";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4"></div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
