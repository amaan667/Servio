"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryOverview } from "@/components/inventory/InventoryOverview";
import { InventoryMovements } from "@/components/inventory/InventoryMovements";
import { Package, History } from "lucide-react";

interface InventoryClientProps {

}

export default function InventoryClient({
  venueId,

  canEdit = true,
}: InventoryClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Movements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <InventoryOverview venueId={venueId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="movements" className="mt-6">
          <InventoryMovements venueId={venueId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
