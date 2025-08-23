'use client';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';

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
  const currentSeg = [...segs].reverse().find(s => !s.startsWith('[')) || 'dashboard';
  const currentLabel = titleFor(currentSeg);

  const crumbs = [
    { label: currentLabel, current: true as const },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Home', href: '/' }
  ];

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-4">
      <ol className="flex items-center gap-2">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {'current' in c && c.current ? (
              <span className="font-semibold text-foreground">{c.label}</span>
            ) : (
              <Link href={(c as any).href} className="hover:underline">{c.label}</Link>
            )}
            {i < crumbs.length - 1 && <span className="text-gray-400 font-medium">←</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}


