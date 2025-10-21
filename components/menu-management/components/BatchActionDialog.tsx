import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BatchAction } from '../types';

interface BatchActionDialogProps {
  batchAction: BatchAction;
  batchEditValue: any;
  setBatchEditValue: (value: any) => void;
  onClose: () => void;
  onConfirm: () => void;
  saving: string | null;
}

export function BatchActionDialog({
  batchAction,
  batchEditValue,
  setBatchEditValue,
  onClose,
  onConfirm,
  saving,
}: BatchActionDialogProps) {
  if (!batchAction) return null;

  return (
    <Dialog open={!!batchAction} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Batch {batchAction === "edit" ? "Edit" : batchAction === "unavailable" ? "Mark Unavailable" : batchAction === "category" ? "Change Category" : batchAction === "price" ? "Bulk Price Edit" : "Delete"}
          </DialogTitle>
        </DialogHeader>
        {batchAction === "category" && (
          <Input 
            placeholder="New category" 
            value={batchEditValue || ""} 
            onChange={e => setBatchEditValue(e.target.value)} 
          />
        )}
        {batchAction === "price" && (
          <Input 
            placeholder="New price" 
            type="number" 
            value={batchEditValue || ""} 
            onChange={e => setBatchEditValue(e.target.value)} 
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} disabled={saving === "batch"}>
            {saving === "batch" ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

