import type { Doc } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProviderIcon } from "../provider-icons";

type AvailableModel = Doc<"userModels"> | Doc<"builtInModels">;

export const ModelPickerTrigger = ({
  open,
  selectedModel,
}: {
  open: boolean;
  selectedModel: AvailableModel | null | undefined;
}) => {
  return (
    <>
      <label id="model-picker-label" className="sr-only">
        Select a model
      </label>
      <Button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby="model-picker-label"
        variant="ghost"
        className={cn(
          "h-6 w-auto gap-1 px-1.5 py-0.5 text-xs font-medium sm:h-7 sm:gap-1.5 sm:px-2 sm:text-xs",
          "text-muted-foreground/70 hover:text-foreground/90",
          "hover:bg-accent/40 dark:hover:bg-accent/20",
          "transition-all duration-200",
          open && "bg-accent/40 dark:bg-accent/20 text-foreground/90"
        )}
      >
        <div className="flex items-center gap-1">
          <ProviderIcon
            provider={selectedModel?.free ? "polly" : selectedModel?.provider}
            className="h-3 w-3"
          />
          <span className="max-w-[120px] truncate font-medium">
            {selectedModel?.name || "Select model"}
          </span>
        </div>
      </Button>
    </>
  );
};
