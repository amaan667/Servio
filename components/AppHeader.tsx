"use client";

import { usePathname } from "next/navigation";
import GlobalNav from "@/components/global-nav";

export default function AppHeader() {
  const pathname = usePathname();
  const hideOnDashboard = pathname?.startsWith("/dashboard");
  if (hideOnDashboard) return null;
  return <GlobalNav />;
}
