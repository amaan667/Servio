/**
 * Common Sorting Types
 */

export type SortOrder = 'asc' | 'desc';

export interface SortParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}

export const DEFAULT_SORT: SortParams = {
  sortBy: 'created_at',
  sortOrder: 'desc',
};

export function parseSortParams(sortBy?: string, sortOrder?: string): SortParams {
  if (!sortBy) {
    return DEFAULT_SORT;
  }
  
  return {
    sortBy,
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  };
}

