"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FilterType = "ALL" | "FREE" | "OCCUPIED" | "RESERVED";

interface TabFiltersNewProps {
  value: FilterType;
  onChange: (value: FilterType) => void;
  counts: {
    all: number;
    free: number;
    occupied: number;
    reserved: number;
  };
}

export function TabFiltersNew({ value, onChange, counts }: TabFiltersNewProps) {
  const filters = [
    { key: "ALL" as const, label: "All", count: counts.all },
    { key: "FREE" as const, label: "Free", count: counts.free },
    { key: "OCCUPIED" as const, label: "Occupied", count: counts.occupied },
    { key: "RESERVED" as const, label: "Reserved", count: counts.reserved },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={value === filter.key ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(filter.key)}
          className="h-8 px-3 text-sm"
        >
          {filter.label}
          <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-xs">
            {filter.count}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
