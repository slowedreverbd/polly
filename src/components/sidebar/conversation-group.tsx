import { PushPinIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

type ConversationGroupProps = {
  title: string;
  children: ReactNode;
};

export const ConversationGroup = ({
  title,
  children,
}: ConversationGroupProps) => {
  return (
    <div className="stack-sm">
      <h3 className="px-2.5 pt-2 pb-1 text-xs font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-1">
        {title === "Pinned" && (
          <PushPinIcon className="h-3.5 w-3.5 mr-1" weight="fill" />
        )}
        <span>{title}</span>
      </h3>
      <div className="stack-xs">{children}</div>
    </div>
  );
};
