import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-70 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-white text-servio-purple hover:bg-gray-50 hover:text-servio-purple-dark shadow-md hover:shadow-lg border-2 border-servio-purple",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md",
        outline:
          "border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 dark:border-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:border-gray-500 dark:hover:text-gray-100 shadow-sm hover:shadow-md",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm hover:shadow-md",
        ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-100",
        link: "text-servio-purple underline-offset-4 hover:underline",
        servio: "bg-white text-servio-purple hover:bg-gray-50 hover:text-servio-purple-dark shadow-md hover:shadow-lg border-2 border-servio-purple",
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
  },
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
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
