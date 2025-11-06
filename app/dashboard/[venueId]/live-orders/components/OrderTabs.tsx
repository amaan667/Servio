"use client";

import { Clock, Timer, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OrderTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts: {
    live: number;
    earlier: number;
    history: number;
  };
}

export function OrderTabs({ activeTab, onTabChange, counts }: OrderTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="live" className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Live Orders
          {counts.live > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 min-w-[1.5rem] h-5 px-1.5 text-xs font-semibold"
            >
              {counts.live}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="all" className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Earlier Today
          {counts.earlier > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 min-w-[1.5rem] h-5 px-1.5 text-xs font-semibold"
            >
              {counts.earlier}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          History
          {counts.history > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 min-w-[1.5rem] h-5 px-1.5 text-xs font-semibold"
            >
              {counts.history}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
