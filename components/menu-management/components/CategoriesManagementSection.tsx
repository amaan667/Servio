import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Grid, RefreshCw, PlusCircle } from "lucide-react";
import { CategoriesManagement } from "@/components/CategoriesManagement";

interface CategoriesManagementSectionProps {
  venueId: string;
  menuItemsCount: number;
  onRefresh: () => void;
}

export function CategoriesManagementSection({
  venueId,
  menuItemsCount: _menuItemsCount,
  onRefresh,
}: CategoriesManagementSectionProps) {
  const [showCategories, setShowCategories] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Grid className="h-5 w-5" />
            <span>Categories</span>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowCategories(!showCategories)}
            className="flex items-center space-x-2"
          >
            {showCategories ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>{showCategories ? "Hide" : "Manage"}</span>
          </Button>
        </CardTitle>
      </CardHeader>
      {showCategories && (
        <CardContent>
          <CategoriesManagement venueId={venueId} onCategoriesUpdate={onRefresh} />
        </CardContent>
      )}
    </Card>
  );
}
