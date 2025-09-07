'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type FilterType = 'ALL' | 'FREE' | 'OCCUPIED' | 'RESERVED_NOW' | 'RESERVED_LATER' | 'WAITING';

interface TabFiltersRefactoredProps {
  value: FilterType;
  onChange: (value: FilterType) => void;
  counts: {
    all: number;
    free: number;
    occupied: number;
    reserved_now: number;
    reserved_later: number;
    waiting: number;
  };
}

export function TabFiltersRefactored({ value, onChange, counts }: TabFiltersRefactoredProps) {
  const filters = [
    { key: 'ALL' as const, label: 'All Tables', count: counts.all },
    { key: 'FREE' as const, label: 'Free Now', count: counts.free },
    { key: 'OCCUPIED' as const, label: 'In Use Now', count: counts.occupied },
    { key: 'RESERVED_NOW' as const, label: 'Reserved Now', count: counts.reserved_now },
    { key: 'RESERVED_LATER' as const, label: 'Reserved Later', count: counts.reserved_later },
    { key: 'WAITING' as const, label: 'Waiting', count: counts.waiting },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={value === filter.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(filter.key)}
          className="relative"
        >
          {filter.label}
          {filter.count > 0 && (
            <Badge 
              variant={value === filter.key ? 'secondary' : 'default'}
              className="ml-2 h-5 px-1.5 text-xs"
            >
              {filter.count}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
}
