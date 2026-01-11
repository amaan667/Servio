"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

interface GroupSizeModalProps {

}

export function GroupSizeModal({
  show,
  groupSize,
  showCustomGroupSize,
  customGroupSize,
  onClose,
  onSetGroupSize,
  onShowCustomGroupSize,
  onSetCustomGroupSize,
  onHideCustomGroupSize,
  onSubmit,
  mode,
}: GroupSizeModalProps) {
  // Render instantly - no delays
  if (!show) return null;

  const title = mode === "initial" ? "How many people are you ordering for?" : "Update Group Size";

  const description =
    mode === "initial"
      ? "This helps us track your table and manage orders efficiently."
      : `Current: ${groupSize} ${groupSize === 1 ? "person" : "people"}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="pb-4">
          <CardTitle className="text-center text-lg sm:text-xl">{title}</CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!showCustomGroupSize ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                  <Button
                    key={size}
                    variant={groupSize === size ? "default" : "outline"}
                    onClick={() => {
                      onSetGroupSize(size);
                      onHideCustomGroupSize();
                    }}
                    className={`h-10 sm:h-12 text-sm sm:text-base transition-all duration-200 !text-white ${
                      groupSize === size
                        ? "bg-servio-purple hover:bg-servio-purple-dark border-servio-purple shadow-lg ring-2 ring-servio-purple ring-opacity-50"

                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {groupSize === size && <Check className="h-4 w-4" />}
                      {size} {size === 1 ? "Person" : "People"}
                    </div>
                  </Button>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant={showCustomGroupSize ? "default" : "outline"}
                  onClick={onShowCustomGroupSize}
                  className={`w-full h-10 sm:h-12 text-sm sm:text-base border-dashed transition-all duration-200 !text-white ${
                    showCustomGroupSize
                      ? "bg-servio-purple hover:bg-servio-purple-dark border-servio-purple shadow-lg ring-2 ring-servio-purple ring-opacity-50"

                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {showCustomGroupSize && <Check className="h-4 w-4" />}
                    Other (More than 8)
                  </div>
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Number of people:</label>
                <Input
                  type="number"
                  min="9"
                  max="50"
                  value={customGroupSize}
                  onChange={(e) => onSetCustomGroupSize(e.target.value)}
                  placeholder="Enter number of people (9-50)"
                  className="h-10 sm:h-12 text-center text-lg border-2 focus:border-purple-500"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  onHideCustomGroupSize();
                  onSetCustomGroupSize("");
                }}
                className="w-full h-10 sm:h-12"
              >
                Back to Options
              </Button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                onHideCustomGroupSize();
                onSetCustomGroupSize("");
              }}
              className="flex-1 h-10 sm:h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const finalSize =
                  showCustomGroupSize && customGroupSize ? parseInt(customGroupSize) : groupSize;
                if (finalSize && finalSize > 0) {
                  onSubmit(finalSize);
                  onHideCustomGroupSize();
                  onSetCustomGroupSize("");
                }
              }}
              variant="servio"
              className="flex-1 h-10 sm:h-12 font-medium shadow-sm"
              disabled={
                showCustomGroupSize
                  ? !customGroupSize ||
                    parseInt(customGroupSize) < 9 ||
                    isNaN(parseInt(customGroupSize))

              }
            >
              {mode === "initial" ? "Continue" : "Update"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
