"use client";

import { useState } from "react";
import { MenuManagement } from "@/components/menu-management";
import { MenuUploadCard } from "@/components/MenuUploadCard";

import type { AuthSession } from "@/components/menu-management/types";

interface MenuManagementWrapperProps {
  venueId: string;
  session: AuthSession | null | undefined;
}

export function MenuManagementWrapper({ venueId, session }: MenuManagementWrapperProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <MenuUploadCard venueId={venueId} onSuccess={handleUploadSuccess} />
      <MenuManagement venueId={venueId} session={session as AuthSession} refreshTrigger={refreshTrigger} />
    </div>
  );
}
