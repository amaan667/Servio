// Shared chip styles for consistent UI across order components

import { cn } from "@/lib/utils";

// Base chip component with consistent styling
export interface ChipProps {
  children: React.ReactNode;
  variant?:
    | "placed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled"
    | "unpaid"
    | "paid"
    | "failed"
    | "refunded";
  className?: string;
}

const chipVariants = {
  // Order status chips
  placed: "bg-amber-50 text-amber-700 border-amber-200",
  preparing: "bg-blue-50 text-blue-700 border-blue-200",
  ready: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-slate-50 text-slate-700 border-slate-200",

  // Payment status chips
  unpaid: "bg-rose-50 text-rose-700 border-rose-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-orange-50 text-orange-700 border-orange-200",
  refunded: "bg-purple-50 text-purple-700 border-purple-200",
};

export function Chip({ children, variant = "placed", className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
        variant && chipVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Convenience functions for specific chip types
export function OrderStatusChip({
  status,
  className,
}: {
  status: "placed" | "preparing" | "ready" | "served" | "completed" | "cancelled";
  className?: string;
}) {
  const statusMap: Record<string, "placed" | "preparing" | "ready" | "completed" | "cancelled"> = {
    PLACED: "placed",
    IN_PREP: "preparing",
    READY: "ready",
    SERVING: "ready", // Treat as ready
    SERVED: "completed",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };

  const variant = statusMap[status.toUpperCase()] || "placed";
  
  // Custom display text for specific statuses
  let displayText: string;
  const upperStatus = status.toUpperCase();
  if (upperStatus === "IN_PREP" || upperStatus === "PREPARING") {
    displayText = "preparing in kitchen";
  } else if (upperStatus === "PLACED") {
    displayText = "placed";
  } else {
    displayText = status.replace("_", " ").toLowerCase();
  }

  return (
    <Chip variant={variant} className={className}>
      {displayText}
    </Chip>
  );
}

export function PaymentStatusChip({
  status,
  className,
}: {
  status: "paid" | "unpaid" | "failed" | "refunded";
  className?: string;
}) {
  const statusMap: Record<string, "paid" | "unpaid" | "failed" | "refunded"> = {
    PAID: "paid",
    UNPAID: "unpaid",
    TILL: "paid", // Treat till as paid
    FAILED: "failed",
    REFUNDED: "refunded",
  };

  const variant = statusMap[status.toUpperCase()] || "unpaid";

  return (
    <Chip variant={variant} className={className}>
      {status.toLowerCase()}
    </Chip>
  );
}
