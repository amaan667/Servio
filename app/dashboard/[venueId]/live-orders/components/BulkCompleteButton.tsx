"use client";

import { Button } from "@/components/ui/button";

interface BulkCompleteButtonProps {
  count: number;
  isCompleting: boolean;
  onClick: () => void;
}

export function BulkCompleteButton({ count, isCompleting, onClick }: BulkCompleteButtonProps) {
  if (count === 0) return null;

  return (
    <div className="flex justify-center mb-8">
      <Button
        onClick={onClick}
        disabled={isCompleting}
        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg text-sm shadow-md hover:shadow-lg transition-all duration-200 w-full max-w-sm"
      >
        {isCompleting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Completing All Orders...
          </>
        ) : (
          <>Complete All Orders ({count})</>
        )}
      </Button>
    </div>
  );
}
