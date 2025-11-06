"use client";

import { Clock, Timer, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const tabs = [
    {
      key: "live",
      label: "Live Orders",
      icon: <Clock className="h-4 w-4" />,
      count: counts.live,
    },
    {
      key: "all",
      label: "Earlier Today",
      icon: <Timer className="h-4 w-4" />,
      count: counts.earlier,
    },
    {
      key: "history",
      label: "History",
      icon: <History className="h-4 w-4" />,
      count: counts.history,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
            ${
              activeTab === tab.key
                ? "bg-purple-50 text-purple-700 border-2 border-purple-600 shadow-sm"
                : "bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-50"
            }
          `}
        >
          {tab.icon}
          <span className="whitespace-nowrap">{tab.label}</span>
          {tab.count > 0 && (
            <Badge
              variant="secondary"
              className={`
                ml-1 min-w-[1.5rem] h-5 px-1.5 text-xs font-semibold
                ${
                  activeTab === tab.key
                    ? "bg-purple-600 text-white"
                    : "bg-purple-100 text-purple-700"
                }
              `}
            >
              {tab.count}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
