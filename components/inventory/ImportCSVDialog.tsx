"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, XCircle } from "lucide-react";

interface ImportCSVDialogProps {

}

interface CSVError {

}

interface ImportResult {

}

export function ImportCSVDialog({ open, onOpenChange, venueId, onSuccess }: ImportCSVDialogProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("venue_id", venueId);

      const response = await fetch("/api/inventory/import/csv", {

      const data = await response.json();
      setResult(data);

      if (data.success && data.error_count === 0) {
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          setFile(null);
          setResult(null);
        }, 2000);
      }
    } catch (_error) {
      setResult({ success: false, error: "Failed to import CSV", error_count: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Ingredients from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your ingredient data. Required columns: Name, Unit
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Expected format: Name, SKU, Unit, Cost Per Unit, On Hand, Par Level, Reorder Level,
                Supplier
              </p>
            </div>

            {result ? (
              <Alert
                variant={result.success && result.error_count === 0 ? "default" : "destructive"}
              >
                {result.success && result.error_count === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {result.success ? (
                    <>
                      Successfully imported {result.imported_count} ingredient(s).
                      {result.error_count > 0 && ` ${result.error_count} error(s) occurred.`}
                    </>
                  ) : (
                    result.error || "Failed to import CSV"
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            {result &&
            typeof result === "object" &&
            "errors" in result &&
            Array.isArray(result.errors) &&
            result.errors.length > 0 ? (
              <div className="max-h-32 overflow-y-auto text-sm">
                <p className="font-medium mb-1">Errors:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-red-600">
                    {err.row}: {err.error}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              <Upload className="h-4 w-4 mr-2" />
              {loading ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
