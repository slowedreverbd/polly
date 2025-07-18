import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-body font-ui shadow-sm transition-colors file:border-0 file:bg-transparent file:text-body-sm file:font-ui file:text-foreground placeholder:text-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 selectable-auto",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
