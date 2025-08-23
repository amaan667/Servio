"use client";

import { usePathname } from "next/navigation";
import UniversalHeader from "@/components/UniversalHeader";

export default function AppHeader() {
  const pathname = usePathname();
  const hideOnDashboard = pathname?.startsWith("/dashboard");
  const hideOnSettings = pathname?.startsWith("/settings");
  
  if (hideOnDashboard || hideOnSettings) return null;
  
  // Home page: show only hamburger menu (red circle)
  return <UniversalHeader showHamburgerMenu={true} showProfileMenu={false} />;
}
