import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-body font-sans shadow-sm transition-[background-color,border-color,color,box-shadow] duration-200 file:border-0 file:bg-transparent file:text-body-sm file:font-sans file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 selectable-auto",
          // Bespoke input colors for consistent styling
          "hover:bg-input-hover",
          "focus-visible:bg-input-focus focus:border-border",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
