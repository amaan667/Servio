import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrCode, Plus } from "lucide-react";

interface TableItem {
  id: string;
  label: string;
  table_number?: number;
  table_id?: string;
  name?: string;
}

interface CounterItem {
  id?: string;
  counter_id?: string;
  name?: string;
  label?: string;
  counter_name?: string;
  table_number?: number;
  table_id?: string;
}

interface QRCodeGeneratorProps {
  qrCodeType: "tables" | "counters" | "custom";
  onTypeChange: (type: "tables" | "counters" | "custom") => void;
  inputName: string;
  onInputNameChange: (name: string) => void;
  onGenerate: () => void;
  onGenerateAll: () => void;
  tables: TableItem[];
  counters: CounterItem[];
}

export function QRCodeGenerator({
  qrCodeType,
  onTypeChange,
  inputName,
  onInputNameChange,
  onGenerate,
  onGenerateAll,
  tables,
  counters,
}: QRCodeGeneratorProps) {
  const items = qrCodeType === "tables" ? tables : counters;

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
            <SelectTrigger className="rounded-lg mt-1 border-2 border-servio-purple bg-white text-servio-purple focus:ring-2 focus:ring-servio-purple/40 focus:border-servio-purple/60 [&>span]:text-servio-purple [&_svg]:text-servio-purple">
              <SelectValue className="text-servio-purple" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tables">Tables</SelectItem>
              <SelectItem value="counters">Counters</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {qrCodeType === "custom" ? (
          <div>
            <Label>Custom Name</Label>
            <Input
              value={inputName}
              onChange={(e) => onInputNameChange(e.target.value)}
              placeholder="Enter any name for your QR code"
              className="rounded-lg mt-1"
            />
          </div>
        ) : (
          <div>
            <Label>Select {qrCodeType === "tables" ? "Table" : "Counter"}</Label>
            <Select value={inputName} onValueChange={onInputNameChange}>
              <SelectTrigger className="rounded-lg mt-1 border-2 border-servio-purple bg-white text-servio-purple focus:ring-2 focus:ring-servio-purple/40 focus:border-servio-purple/60 [&>span]:text-servio-purple [&_svg]:text-servio-purple">
                <SelectValue
                  className="text-servio-purple"
                  placeholder={`Select a ${qrCodeType === "tables" ? "table" : "counter"}`}
                />
              </SelectTrigger>
              <SelectContent>
                {items.map((item: TableItem | CounterItem) => {
                  const isCounter = "counter_id" in item || "counter_name" in item;
                  const key = String(
                    item.id ||
                      (isCounter && "counter_id" in item ? item.counter_id : undefined) ||
                      (isCounter && "table_id" in item ? item.table_id : undefined) ||
                      Math.random()
                  );

                  // Get display value - handle both table and counter naming variations
                  let displayValue = "";
                  if (qrCodeType === "tables") {
                    displayValue = String(
                      item.label ||
                        ("table_number" in item ? item.table_number : undefined) ||
                        ("name" in item ? item.name : undefined) ||
                        ""
                    );
                  } else {
                    displayValue = String(
                      (isCounter && "counter_name" in item ? item.counter_name : undefined) ||
                        item.label ||
                        ("name" in item ? item.name : undefined) ||
                        ""
                    );
                  }

                  // Skip items without a valid display value
                  if (
                    !displayValue ||
                    displayValue === "undefined" ||
                    displayValue === "null" ||
                    displayValue.trim() === ""
                  ) {
                    return null;
                  }

                  return (
                    <SelectItem key={key} value={displayValue}>
                      {displayValue}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onGenerate}
            disabled={!inputName}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate QR Code
          </Button>
          {qrCodeType !== "custom" && (
            <Button
              variant="outline"
              onClick={onGenerateAll}
              disabled={items.length === 0}
              className="text-purple-600 hover:text-white hover:bg-purple-600"
            >
              Generate All
            </Button>
          )}
        </div>

        {qrCodeType === "custom" && (
          <div className="pt-4 border-t bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Custom QR Codes:</strong> Generate QR codes for any name you want. Perfect for
              special events, promotions, or custom locations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
