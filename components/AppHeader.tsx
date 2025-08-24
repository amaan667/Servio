"use client";

import { usePathname } from "next/navigation";
import NavBar from "@/components/NavBar";

export default function AppHeader() {
  const pathname = usePathname();
  const hideOnDashboard = pathname?.startsWith("/dashboard");
  const hideOnSettings = pathname?.startsWith("/settings");
  
  if (hideOnDashboard || hideOnSettings) return null;
  
  return <NavBar />;
}
