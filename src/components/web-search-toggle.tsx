import { GlobeIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type WebSearchToggleProps = {
  enabled?: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
};

export const WebSearchToggle = ({
  enabled = false,
  onToggle,
  className,
}: WebSearchToggleProps) => {
  const handleToggle = () => {
    onToggle(!enabled);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          className={cn(
            "h-auto px-2 py-1 text-xs font-medium text-muted-foreground/80 hover:text-foreground group relative picker-trigger",
            "hover:bg-accent/50 dark:hover:bg-accent/30",
            "transition-all duration-200",
            enabled && "bg-accent/50 dark:bg-accent/30 text-info",
            className
          )}
          onClick={handleToggle}
        >
          <div className="flex items-center gap-1.5">
            <GlobeIcon
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                enabled
                  ? "text-info"
                  : "text-muted-foreground/60 group-hover:text-foreground"
              )}
            />
            <span className="hidden font-medium sm:inline">Search</span>
          </div>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs font-medium">
          {enabled ? "Disable" : "Enable"} Search Grounding
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
