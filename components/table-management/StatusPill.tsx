import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Clock,
  Utensils,
  CheckCircle2,
  UserCheck,
  Receipt,
  Calendar,
  XCircle,
} from "lucide-react";

interface StatusPillProps {

}

const statusConfig = {

  },

  },

  },

  },

  },

  },

  },

  },

  },
};

export function StatusPill({ status, className = "" }: StatusPillProps) {
  const config = statusConfig[status];

  // Handle undefined config gracefully
  if (!config) {
    return (
      <Badge
        variant="outline"
        className={`bg-gray-50 text-gray-700 ring-gray-100 ${className} flex items-center gap-1.5 px-2.5 py-1`}
      >
        <span className="text-xs font-medium">{status}</span>
      </Badge>
    );
  }

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
