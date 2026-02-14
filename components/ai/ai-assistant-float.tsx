"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface AIAssistantFloatProps {
  onClick: () => void;
}

export function AIAssistantFloat({ onClick }: AIAssistantFloatProps) {
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform));
  }, []);

  if (!mounted) return null;

  // On mobile dashboard pages, the bottom nav is visible so shift the button up
  const hasBottomNav =
    isMobile && (pathname?.startsWith("/dashboard") || pathname?.includes("/qr-codes"));

  const shortcutKey = isMac ? "⌘K" : "Ctrl+K";

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`fixed right-4 sm:right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group ${
              hasBottomNav ? "bottom-28" : "bottom-6"
            }`}
            aria-label="Open AI Assistant"
          >
            <Sparkles className="h-6 w-6 text-white group-hover:animate-pulse" fill="white" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-purple-500 items-center justify-center text-[10px] font-bold text-white">
                AI
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-purple-600 text-white border-purple-700">
          <div className="flex flex-col items-center gap-1">
            <span className="font-semibold text-white">AI Assistant</span>
            <span className="text-xs opacity-90 text-white">
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-purple-700 rounded text-white font-mono">
                {shortcutKey}
              </kbd>
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
