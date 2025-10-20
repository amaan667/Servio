"use client";

import { useState } from "react";
import { MenuManagement } from "@/components/menu-management";
import { MenuUploadCard } from "@/components/MenuUploadCard";

interface MenuManagementWrapperProps {
  venueId: string;
  session: unknown;
}

export function MenuManagementWrapper({ venueId, session }: MenuManagementWrapperProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <MenuUploadCard venueId={venueId} onSuccess={handleUploadSuccess} />
      <MenuManagement 
        venueId={venueId} 
        session={session} 
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
