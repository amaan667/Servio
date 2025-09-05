import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  Utensils, 
  CheckCircle2, 
  UserCheck, 
  Receipt, 
  Calendar,
  XCircle
} from 'lucide-react';

interface StatusPillProps {
  status: 'FREE' | 'ORDERING' | 'IN_PREP' | 'READY' | 'SERVED' | 'AWAITING_BILL' | 'RESERVED' | 'CLOSED';
  className?: string;
}

const statusConfig = {
  FREE: {
    icon: CheckCircle,
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    label: 'Free'
  },
  ORDERING: {
    icon: Clock,
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    label: 'Ordering'
  },
  IN_PREP: {
    icon: Utensils,
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    label: 'In Prep'
  },
  READY: {
    icon: CheckCircle2,
    className: 'bg-violet-50 text-violet-700 ring-violet-100',
    label: 'Ready'
  },
  SERVED: {
    icon: UserCheck,
    className: 'bg-violet-50 text-violet-700 ring-violet-100',
    label: 'Served'
  },
  AWAITING_BILL: {
    icon: Receipt,
    className: 'bg-slate-50 text-slate-700 ring-slate-200',
    label: 'Awaiting Bill'
  },
  RESERVED: {
    icon: Calendar,
    className: 'bg-sky-50 text-sky-700 ring-sky-100',
    label: 'Reserved'
  },
  CLOSED: {
    icon: XCircle,
    className: 'bg-zinc-50 text-zinc-600 ring-zinc-200',
    label: 'Closed'
  }
};

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${className} flex items-center gap-1.5 px-2.5 py-1`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  );
}
