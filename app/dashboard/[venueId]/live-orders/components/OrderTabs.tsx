"use client";

import { Clock } from "lucide-react";

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
      label: "Live",
      longLabel: "Live Orders",
      hint: "Recent orders",
      count: counts.live,
    },
    {
      key: "all",
      label: "Earlier",
      longLabel: "Earlier Today",
      hint: "Today's orders",
      count: counts.earlier,
    },
    {
      key: "history",
      label: "History",
      longLabel: "History",
      hint: "Previous days",
      count: counts.history,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto">
      <div className="inline-flex rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200 min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              group relative grid grid-rows-[1fr_auto] rounded-xl px-3 py-2 sm:px-4 text-left transition-all duration-200 min-w-[5rem] sm:w-[11rem] border-2
              ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white border-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.4)] hover:bg-purple-700"
                  : "bg-white text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600"
              }
            `}
          >
            <span className="flex items-center justify-between">
              <span className="font-medium text-sm sm:text-base">
                <span className="sm:hidden">{tab.label}</span>
                <span className="hidden sm:inline">{tab.longLabel}</span>
              </span>
              <span
                className={`
                ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 sm:px-2 text-xs font-medium transition-all duration-200
                ${
                  activeTab === tab.key
                    ? "bg-white text-purple-600"
                    : "bg-purple-100 text-purple-600 group-hover:bg-white group-hover:text-purple-600"
                }
              `}
              >
                {tab.count}
              </span>
            </span>
            <span
              className={`
              mt-0.5 text-xs hidden sm:block transition-all duration-200
              ${activeTab === tab.key ? "text-white opacity-90" : "text-purple-600 group-hover:text-white group-hover:opacity-90"}
            `}
            >
              {tab.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
