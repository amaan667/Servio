"use client";

import { usePathname } from "next/navigation";
import GlobalNav from "@/components/global-nav";

export default function AppHeader() {
  const pathname = usePathname();
  const hideOnDashboard = pathname?.startsWith("/dashboard");
  const hideOnSettings = pathname?.startsWith("/settings");
  if (hideOnDashboard || hideOnSettings) return null;
  return <GlobalNav />;
}
