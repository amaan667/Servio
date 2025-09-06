'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type FilterType = 'ALL' | 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLOSED';

interface TabFiltersProps {
  value: FilterType;
  onChange: (filter: FilterType) => void;
  counts?: {
    all: number;
    free: number;
    occupied: number;
    reserved: number;
    closed: number;
  };
}

export function TabFilters({ value, onChange, counts }: TabFiltersProps) {
  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'ALL', label: 'All', count: counts?.all },
    { key: 'FREE', label: 'Free', count: counts?.free },
    { key: 'OCCUPIED', label: 'Occupied', count: counts?.occupied },
    { key: 'RESERVED', label: 'Reserved', count: counts?.reserved },
    { key: 'CLOSED', label: 'Closed Today', count: counts?.closed },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={value === filter.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(filter.key)}
          className="rounded-2xl"
        >
          {filter.label}
          {filter.count !== undefined && (
            <Badge 
              variant={value === filter.key ? 'secondary' : 'outline'} 
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
