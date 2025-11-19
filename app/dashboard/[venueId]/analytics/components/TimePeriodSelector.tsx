import { Calendar, CalendarIcon, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePeriod } from "../hooks/useAnalyticsData";

interface TimePeriodSelectorProps {
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  customDateRange: { start: string; end: string } | null;
  onCustomDateRangeChange: (range: { start: string; end: string } | null) => void;
  onExportCSV: () => void;
  isDownloading: boolean;
  hasData: boolean;
}

export function TimePeriodSelector({
  timePeriod,
  onTimePeriodChange,
  customDateRange,
  onCustomDateRangeChange,
  onExportCSV,
  isDownloading,
  hasData,
}: TimePeriodSelectorProps) {
  return (
    <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground hidden sm:inline">Time period:</span>
          <Select
            value={timePeriod}
            onValueChange={(value: TimePeriod) => {
              onTimePeriodChange(value);
              onCustomDateRangeChange(null);
            }}
          >
            <SelectTrigger className="w-40 border-2 border-servio-purple bg-white text-servio-purple focus:ring-2 focus:ring-servio-purple/40 focus:border-servio-purple/60 [&>span]:text-servio-purple [&_svg]:text-servio-purple">
              <SelectValue className="text-servio-purple" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">or</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-40 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customDateRange
                  ? `${new Date(customDateRange.start).toLocaleDateString()} - ${new Date(customDateRange.end).toLocaleDateString()}`
                  : "Custom range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={customDateRange?.start || ""}
                    onChange={(e) =>
                      onCustomDateRangeChange({
                        start: e.target.value,
                        end: customDateRange?.end || new Date().toISOString().split("T")[0],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={customDateRange?.end || ""}
                    onChange={(e) =>
                      onCustomDateRangeChange({
                        start: customDateRange?.start || new Date().toISOString().split("T")[0],
                        end: e.target.value,
                      })
                    }
                  />
                </div>
                <Button
                  onClick={() => {
                    if (customDateRange?.start && customDateRange?.end) {
                      onTimePeriodChange("7d"); // Reset to trigger refresh
                    }
                  }}
                  className="w-full"
                >
                  Apply Custom Range
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <Button
          onClick={onExportCSV}
          disabled={!hasData || isDownloading}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-white text-sm hover:bg-purple-700 disabled:opacity-50 w-full sm:w-auto"
          title="Exports the rows you're viewing"
        >
          <Download className="h-4 w-4" />
          {isDownloading ? "Generating..." : "Download CSV"}
        </Button>
        <div className="flex items-center space-x-2 text-xs sm:text-sm">
          <span className="text-gray-900">Last updated:</span>
          <span className="font-medium text-gray-900">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
