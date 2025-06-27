"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-6 w-6"
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-muted border-t-foreground",
        sizeClasses[size],
        className
      )}
    />
  );
}
