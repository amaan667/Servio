"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

interface MobileCartButtonProps {
  totalItems: number;
  onClick: () => void;
}

export function MobileCartButton({ totalItems, onClick }: MobileCartButtonProps) {
  return (
    <div className="lg:hidden fixed bottom-4 right-4 z-40">
      <Button
        onClick={onClick}
        className="rounded-full w-14 h-14 shadow-lg relative"
        variant="servio"
        size="icon"
      >
        <ShoppingCart className="h-6 w-6" />
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
            {totalItems}
          </span>
        )}
      </Button>
    </div>
  );
}

