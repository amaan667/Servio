import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Clock } from "lucide-react";
import { DAYS_OF_WEEK, OperatingHours } from "../hooks/useVenueSettings";

interface OperatingHoursCardProps {
  operatingHours: OperatingHours;
  updateDayHours: (
    day: string,
    field: "open" | "close" | "closed",
    value: string | boolean
  ) => void;
}

export function OperatingHoursCard({ operatingHours, updateDayHours }: OperatingHoursCardProps) {
  const formatDayName = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Clock className="h-5 w-5 text-purple-600" />
          Operating Hours
        </CardTitle>
        <CardDescription>Set your venue's operating hours</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {DAYS_OF_WEEK.map((day) => {
          const dayHours = operatingHours[day as keyof OperatingHours] || {
            open: "09:00",
            close: "17:00",
            closed: false,
          };

          return (
            <div key={day} className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{formatDayName(day)}</Label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${!dayHours.closed ? "text-green-600" : "text-gray-600"}`}
                  >
                    {!dayHours.closed ? "Open" : "Closed"}
                  </span>
                  <Switch
                    checked={!dayHours.closed}
                    onCheckedChange={(checked) => updateDayHours(day, "closed", !checked)}
                  />
                </div>
              </div>

              {!dayHours.closed && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`${day}-open`} className="text-sm">
                      Opening Time
                    </Label>
                    <Input
                      id={`${day}-open`}
                      type="time"
                      value={dayHours.open}
                      onChange={(e) => updateDayHours(day, "open", e.target.value)}
                      className="rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${day}-close`} className="text-sm">
                      Closing Time
                    </Label>
                    <Input
                      id={`${day}-close`}
                      type="time"
                      value={dayHours.close}
                      onChange={(e) => updateDayHours(day, "close", e.target.value)}
                      className="rounded-lg mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
