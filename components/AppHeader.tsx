"use client";

import { usePathname } from "next/navigation";
import UniversalHeader from "@/components/UniversalHeader";

export default function AppHeader() {
  const pathname = usePathname();
  // Always show header; dashboard layouts inject their own header instance already
  // Keep single header on non-dashboard pages
  const isDashboardOrSettings = pathname?.startsWith("/dashboard") || pathname?.startsWith("/settings");
  if (isDashboardOrSettings) return null;
  return <UniversalHeader />;
}
