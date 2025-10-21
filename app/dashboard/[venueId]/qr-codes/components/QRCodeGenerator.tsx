import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Plus } from "lucide-react";

interface QRCodeGeneratorProps {
  qrCodeType: 'tables' | 'counters';
  onTypeChange: (type: 'tables' | 'counters') => void;
  inputName: string;
  onInputNameChange: (name: string) => void;
  onGenerate: () => void;
  onGenerateAll: () => void;
  tables: any[];
  counters: any[];
}

export function QRCodeGenerator({
  qrCodeType,
  onTypeChange,
  inputName,
  onInputNameChange,
  onGenerate,
  onGenerateAll,
  tables,
  counters
}: QRCodeGeneratorProps) {
  const items = qrCodeType === 'tables' ? tables : counters;

  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <QrCode className="h-5 w-5 text-purple-600" />
          Generate QR Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>QR Code Type</Label>
          <Select value={qrCodeType} onValueChange={onTypeChange}>
            <SelectTrigger className="rounded-lg mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tables">Tables</SelectItem>
              <SelectItem value="counters">Counters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Select {qrCodeType === 'tables' ? 'Table' : 'Counter'}</Label>
          <Select value={inputName} onValueChange={onInputNameChange}>
            <SelectTrigger className="rounded-lg mt-1">
              <SelectValue placeholder={`Select a ${qrCodeType === 'tables' ? 'table' : 'counter'}`} />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={qrCodeType === 'tables' ? item.label : item.name}>
                  {qrCodeType === 'tables' ? item.label : item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onGenerate}
            disabled={!inputName}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate QR Code
          </Button>
          <Button
            variant="outline"
            onClick={onGenerateAll}
            disabled={items.length === 0}
          >
            Generate All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

