"use client";
import Link from "next/link";
import { useSelectedLayoutSegments, usePathname } from "next/navigation";

function titleFor(seg: string) {
  if (!seg) return "";
  if (seg === "dashboard") return "Dashboard";
  if (seg === "live-orders") return "Live Orders";
  if (seg === "menu") return "Menu Management";
  if (seg === "analytics") return "Analytics";
  return seg.replace(/[-_]/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

export default function Breadcrumbs() {
  const segs = useSelectedLayoutSegments();
  const pathname = usePathname();
  const currentSeg = [...(segs || [])].reverse().find((s) => !s.startsWith("[")) || "dashboard";
  const currentLabel = titleFor(currentSeg);

  // Extract venueId from pathname
  const venueId = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];
  const dashboardHref = venueId ? `/dashboard/${venueId}` : "/";

  const crumbs = [
    { label: currentLabel, current: true as const },
    { label: "Dashboard", href: dashboardHref },
    { label: "Home", href: "/" },
  ];

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-700 mb-4">
      <ol className="flex items-center gap-2">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {"current" in c && c.current ? (
              <span className="inline-flex items-center px-3 py-1 rounded-md font-medium text-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.6)] bg-white transition-all duration-200">
                {c.label}
              </span>
            ) : (
              <Link
                href={(c as { href: string }).href}
                className="hover:underline text-gray-600 hover:text-purple-600 transition-colors"
              >
                {c.label}
              </Link>
            )}
            {i < crumbs.length - 1 && <span className="text-gray-400">→</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
