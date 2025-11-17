import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation active:scale-[0.97] will-change-transform transform-gpu",
  {
    variants: {
      variant: {
        default:
          "bg-white dark:bg-card text-servio-purple dark:text-servio-purple-light hover:bg-gray-50 dark:hover:bg-accent hover:text-servio-purple-dark dark:hover:text-servio-purple-light shadow-sm hover:shadow-md border-2 border-servio-purple dark:border-servio-purple font-semibold",
        destructive:
          "bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 shadow-sm hover:shadow-md border-2 border-red-600 dark:border-red-700 font-semibold [&_svg]:text-white",
        outline:
          "bg-white dark:bg-card text-servio-purple dark:text-servio-purple-light hover:bg-gray-50 dark:hover:bg-accent hover:text-servio-purple-dark dark:hover:text-servio-purple-light shadow-sm hover:shadow-md border-2 border-servio-purple dark:border-servio-purple font-semibold",
        secondary:
          "bg-white dark:bg-card text-servio-purple dark:text-servio-purple-light hover:bg-gray-50 dark:hover:bg-accent hover:text-servio-purple-dark dark:hover:text-servio-purple-light shadow-sm hover:shadow-md border-2 border-servio-purple dark:border-servio-purple font-semibold",
        ghost:
          "bg-transparent dark:bg-transparent text-servio-purple dark:text-servio-purple-light hover:bg-gray-50 dark:hover:bg-accent hover:text-servio-purple-dark dark:hover:text-servio-purple-light border-2 border-transparent dark:border-transparent font-semibold",
        link: "text-servio-purple dark:text-servio-purple-light underline-offset-4 hover:underline font-semibold",
        servio:
          "bg-white dark:bg-card text-servio-purple dark:text-servio-purple-light hover:bg-gray-50 dark:hover:bg-accent hover:text-servio-purple-dark dark:hover:text-servio-purple-light shadow-sm hover:shadow-md border-2 border-servio-purple dark:border-servio-purple font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2 min-h-[44px] min-w-[44px]",
        sm: "h-9 rounded-xl px-3 min-h-[40px] min-w-[40px]",
        lg: "h-11 rounded-xl px-8 min-h-[48px] min-w-[48px]",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px]",
        mobile: "h-12 px-6 py-3 min-h-[48px] min-w-[48px] text-base rounded-xl",
      },
    },
    defaultVariants: {
      // Use Servio brand styling as the default across the app to ensure
      // consistent button appearance on all feature pages.
      variant: "servio",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
