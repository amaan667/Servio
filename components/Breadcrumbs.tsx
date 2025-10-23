'use client';
import Link from 'next/link';
import { useSelectedLayoutSegments, usePathname } from 'next/navigation';

function titleFor(seg: string) {
  if (!seg) return '';
  if (seg === 'dashboard') return 'Dashboard';
  if (seg === 'live-orders') return 'Live Orders';
  if (seg === 'menu') return 'Menu Management';
  if (seg === 'analytics') return 'Analytics';
  return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
}

export default function Breadcrumbs() {
  const segs = useSelectedLayoutSegments();
  const pathname = usePathname();
  const currentSeg = [...(segs || [])].reverse().find(s => !s.startsWith('[')) || 'dashboard';
  const currentLabel = titleFor(currentSeg);
  
  // Extract venueId from pathname
  const venueId = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];
  const dashboardHref = venueId ? `/dashboard/${venueId}` : '/';

  const crumbs = [
    { label: currentLabel, current: true as const },
    { label: 'Dashboard', href: dashboardHref },
    { label: 'Home', href: '/' }
  ];

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-700 mb-4">
      <ol className="flex items-center gap-2">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {'current' in c && c.current ? (
              <span className="font-medium text-foreground">{c.label}</span>
            ) : (
              <Link href={(c as unknown).href} className="hover:underline">{c.label}</Link>
            )}
            {i < crumbs.length - 1 && <span>→</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

