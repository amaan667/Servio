"use client";

import { Clock, Timer, History } from "lucide-react";
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

function tabCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function OrderTabs({ activeTab, onTabChange, counts }: OrderTabsProps) {
  const live = tabCount(counts?.live);
  const earlier = tabCount(counts?.earlier);
  const history = tabCount(counts?.history);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="live" className="flex items-center gap-2 relative">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">Live Orders</span>
          <span
            className="ml-2 inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold tabular-nums shrink-0 bg-white/90 text-servio-purple"
            aria-label={`${live} live orders`}
          >
            {live}
          </span>
        </TabsTrigger>
        <TabsTrigger value="all" className="flex items-center gap-2 relative">
          <Timer className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">Earlier Today</span>
          <span
            className="ml-2 inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold tabular-nums shrink-0 bg-white/90 text-servio-purple"
            aria-label={`${earlier} earlier today`}
          >
            {earlier}
          </span>
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2 relative">
          <History className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">History</span>
          <span
            className="ml-2 inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold tabular-nums shrink-0 bg-white/90 text-servio-purple"
            aria-label={`${history} history`}
          >
            {history}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
