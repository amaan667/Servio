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

export function OrderTabs({ activeTab, onTabChange, counts }: OrderTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="live" className="flex items-center gap-2 relative">
          <Clock className="h-4 w-4" />
          <span className="flex-1 text-left">Live Orders</span>
          <span
            className={`
              ml-2 inline-flex min-w-[1.5rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200
              ${activeTab === "live" ? "bg-white text-servio-purple" : "bg-white/30 text-white"}
            `}
          >
            {counts.live}
          </span>
        </TabsTrigger>
        <TabsTrigger value="all" className="flex items-center gap-2 relative">
          <Timer className="h-4 w-4" />
          <span className="flex-1 text-left">Earlier Today</span>
          <span
            className={`
              ml-2 inline-flex min-w-[1.5rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200
              ${activeTab === "all" ? "bg-white text-servio-purple" : "bg-white/30 text-white"}
            `}
          >
            {counts.earlier}
          </span>
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2 relative">
          <History className="h-4 w-4" />
          <span className="flex-1 text-left">History</span>
          <span
            className={`
              ml-2 inline-flex min-w-[1.5rem] h-5 px-1.5 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200
              ${activeTab === "history" ? "bg-white text-servio-purple" : "bg-white/30 text-white"}
            `}
          >
            {counts.history}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
