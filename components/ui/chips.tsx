// Shared chip styles for consistent UI across order components

import { cn } from "@/lib/utils";

// Base chip component with consistent styling
export interface ChipProps {

}

const chipVariants = {
  // Order status chips

  // Payment status chips

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

}) {
  const statusMap: Record<string, "placed" | "preparing" | "ready" | "completed" | "cancelled"> = {

    SERVING: "ready", // Treat as ready

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

}) {
  const statusMap: Record<string, "paid" | "unpaid" | "failed" | "refunded"> = {

    TILL: "paid", // Treat till as paid

  };

  const variant = statusMap[status.toUpperCase()] || "unpaid";

  return (
    <Chip variant={variant} className={className}>
      {status.toLowerCase()}
    </Chip>
  );
}
