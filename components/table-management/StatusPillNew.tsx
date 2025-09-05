'use client';

import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertCircle,
  UserCheck,
  Receipt,
  Calendar,
  Square
} from 'lucide-react';

type Status = 'FREE' | 'OCCUPIED';

interface StatusPillNewProps {
  status: Status;
}

const statusConfig = {
  FREE: {
    label: 'Free',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-800 border-green-200',
    iconClassName: 'text-green-600'
  },
  OCCUPIED: {
    label: 'Occupied',
    icon: Users,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    iconClassName: 'text-amber-600'
  }
};

export function StatusPillNew({ status }: StatusPillNewProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium`}
    >
      <Icon className={`h-3 w-3 ${config.iconClassName}`} />
      {config.label}
    </Badge>
  );
}
