"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-12 sm:h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full gap-1",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 sm:px-4 py-2 sm:py-1.5 text-sm sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-[0_0_12px_rgba(147,51,234,0.4)] dark:data-[state=active]:shadow-[0_0_12px_rgba(168,85,247,0.3)] data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-700 data-[state=active]:hover:bg-purple-600 dark:data-[state=active]:hover:bg-purple-700 data-[state=active]:hover:text-white data-[state=inactive]:bg-white dark:data-[state=inactive]:bg-card data-[state=inactive]:text-purple-600 dark:data-[state=inactive]:text-purple-400 data-[state=inactive]:border-2 data-[state=inactive]:border-purple-600 dark:data-[state=inactive]:border-purple-700 flex-1 min-h-[44px] sm:min-h-0 border-2 border-transparent",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 sm:mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
