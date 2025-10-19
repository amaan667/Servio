import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { MenuUploadCard } from "@/components/MenuUploadCard";

interface MenuUploadSectionProps {
  venueId: string;
  onSuccess: () => void;
}

export function MenuUploadSection({ venueId, onSuccess }: MenuUploadSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload Menu</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MenuUploadCard venueId={venueId} onSuccess={onSuccess} />
      </CardContent>
    </Card>
  );
}

