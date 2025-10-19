import { Button } from "@/components/ui/button";

interface BatchActionBarProps {
  selectedCount: number;
  onMarkUnavailable: () => void;
  onChangeCategory: () => void;
  onBulkPriceEdit: () => void;
  onDelete: () => void;
}

export function BatchActionBar({
  selectedCount,
  onMarkUnavailable,
  onChangeCategory,
  onBulkPriceEdit,
  onDelete,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t z-50 shadow-lg flex items-center justify-center gap-4 py-3">
      <span className="font-medium">{selectedCount} selected</span>
      <Button onClick={onMarkUnavailable}>Mark Unavailable</Button>
      <Button onClick={onChangeCategory}>Change Category</Button>
      <Button onClick={onBulkPriceEdit}>Bulk Price Edit</Button>
      <Button variant="destructive" onClick={onDelete}>Delete</Button>
    </div>
  );
}

