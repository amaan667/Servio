'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  QrCode, 
  Users, 
  CheckCircle2, 
  X,
  Download,
  Printer
} from 'lucide-react';
import { TableWithSession } from '@/hooks/useTablesData';
import { buildQRGenerationUrl } from '@/lib/qr-urls';
import { handleQRError } from '@/lib/qr-errors';

interface QRCodeSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  venueName?: string;
  availableTables: TableWithSession[];
  initialSelectedTables?: string[];
}

export function QRCodeSelectionDialog({
  isOpen,
  onClose,
  venueId,
  venueName = "Your Venue",
  availableTables,
  initialSelectedTables = []
}: QRCodeSelectionDialogProps) {
  const [selectedTables, setSelectedTables] = useState<string[]>(initialSelectedTables);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedTables(initialSelectedTables);
    }
  }, [isOpen, initialSelectedTables]);

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(id => id !== tableId)
        : [...prev, tableId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTables.length === availableTables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(availableTables.map(table => table.id));
    }
  };

  const handleGenerateQR = async () => {
    if (selectedTables.length === 0) return;
    
    setIsGenerating(true);
    try {
      // Get table labels for the selected table IDs
      const selectedTableObjects = availableTables.filter(table => 
        selectedTables.includes(table.id)
      );
      const tableLabels = selectedTableObjects.map(table => table.label);
      
      // Create a URL with selected table labels using centralized service
      const qrUrl = buildQRGenerationUrl(venueId, tableLabels);
      
      console.log('[QR CODE] Generating QR for selected tables:', {
        selectedTableIds: selectedTables,
        selectedTableLabels: tableLabels,
        qrUrl
      });
      
      // Open in new tab
      window.open(qrUrl, '_blank');
      onClose();
    } catch (error) {
      handleQRError(error, 'generate_qr_selection');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedTableObjects = availableTables.filter(table => 
    selectedTables.includes(table.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generate QR Codes
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Selection Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Selected Tables ({selectedTables.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedTables.length === availableTables.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {selectedTableObjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedTableObjects.map(table => (
                    <Badge key={table.id} variant="secondary" className="text-xs">
                      {table.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-900">No tables selected</p>
              )}
            </CardContent>
          </Card>

          {/* Table List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Tables</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableTables.map(table => (
                  <div
                    key={table.id}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      id={table.id}
                      checked={selectedTables.includes(table.id)}
                      onCheckedChange={() => handleTableToggle(table.id)}
                    />
                    <label
                      htmlFor={table.id}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{table.label}</span>
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {table.seat_count}
                        </Badge>
                      </div>
                      <Badge 
                        variant={table.status === 'FREE' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {table.status}
                      </Badge>
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-gray-900">
            {selectedTables.length > 0 && (
              <span>
                {selectedTables.length} table{selectedTables.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateQR}
              disabled={selectedTables.length === 0 || isGenerating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Generate QR Codes
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
