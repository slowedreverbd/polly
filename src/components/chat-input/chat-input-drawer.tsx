import { X } from "@phosphor-icons/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";

interface ChatInputDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  children: React.ReactNode;
}

export function ChatInputDrawer({
  open,
  onOpenChange,
  onSubmit,
  textareaRef,
  children,
}: ChatInputDrawerProps) {
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [open, textareaRef]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[95vh] max-h-[95vh]">
        <DrawerHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>
        <div className="flex-1 px-4 pb-safe">
          <div className="h-full">{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
