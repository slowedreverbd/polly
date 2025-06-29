import { Link } from "react-router";

import { useAuthToken } from "@convex-dev/auth/react";
import {
  DotsThreeVerticalIcon,
  FileCodeIcon,
  FileTextIcon,
  ShareNetworkIcon,
  StackPlusIcon,
} from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareConversationDialog } from "@/components/ui/share-conversation-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-user";
import {
  downloadFile,
  exportAsJSON,
  exportAsMarkdown,
  generateFilename,
} from "@/lib/export";
import { ROUTES } from "@/lib/routes";
import { type ConversationId } from "@/types";

import { Skeleton } from "./ui/skeleton";
import { api } from "../../convex/_generated/api";

type ChatHeaderProps = {
  conversationId?: ConversationId;
};

export const ChatHeader = ({ conversationId }: ChatHeaderProps) => {
  const { user } = useUser();
  const token = useAuthToken();

  // Check if user is authenticated (not anonymous)
  const isAuthenticated = Boolean(token) && Boolean(user) && !user?.isAnonymous;

  const conversation = useQuery(
    api.conversations.getAuthorized,
    conversationId ? { id: conversationId, userId: user?._id } : "skip"
  );

  const exportData = useQuery(
    api.conversations.getForExport,
    conversationId ? { id: conversationId } : "skip"
  );

  const persona = useQuery(
    api.personas.get,
    conversation?.personaId ? { id: conversation.personaId } : "skip"
  );

  const handleExport = (format: "json" | "md") => {
    if (!exportData || !conversation) {
      toast.error("Export failed", {
        description: "Unable to load conversation data",
      });
      return;
    }

    try {
      let content: string;
      let mimeType: string;

      if (format === "json") {
        content = exportAsJSON(exportData);
        mimeType = "application/json";
      } else {
        content = exportAsMarkdown(exportData);
        mimeType = "text/markdown";
      }

      const filename = generateFilename(conversation.title, format);
      downloadFile(content, filename, mimeType);

      toast.success("Export successful", {
        description: `Conversation exported as ${filename}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed", {
        description: "An error occurred while exporting the conversation",
      });
    }
  };

  // For chat pages, show full header with conversation title
  return (
    <div className="flex min-h-[2.5rem] w-full items-center justify-between gap-2 sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {conversation === undefined ? (
          // Loading state for title
          <Skeleton className="h-5 w-[120px] sm:w-[200px]" />
        ) : conversation?.title ? (
          <h1 className="truncate text-sm font-medium text-foreground">
            {conversation.title}
          </h1>
        ) : (
          <div className="h-5" />
        )}
        {persona && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className="flex-shrink-0 cursor-default gap-1 sm:gap-2"
                variant="info"
              >
                <span className="text-xs sm:text-sm">
                  {persona.icon || "🤖"}
                </span>
                <span className="text-xxs hidden sm:inline">
                  {persona.name}
                </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="sm:hidden">
              <p>{persona.name}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Only show actions for authenticated users */}
      {conversationId && isAuthenticated && (
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                className="sm:w-auto sm:gap-2 sm:px-3"
                size="icon-sm"
                variant="action"
              >
                <Link to={ROUTES.HOME}>
                  <StackPlusIcon className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">New</span>
                  <span className="sr-only sm:hidden">New chat</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="sm:hidden">
              <p>New chat</p>
            </TooltipContent>
          </Tooltip>
          <ShareConversationDialog conversationId={conversationId}>
            <Button
              className="sm:w-auto sm:gap-2 sm:px-3"
              disabled={!conversation}
              size="icon-sm"
              title={conversation ? "Share conversation" : "Loading..."}
              variant="action"
            >
              <ShareNetworkIcon className="h-4 w-4" />
              <span className="hidden text-xs sm:inline">Share</span>
              <span className="sr-only sm:hidden">Share conversation</span>
            </Button>
          </ShareConversationDialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" title="More options" variant="action">
                <DotsThreeVerticalIcon className="h-4 w-4" weight="bold" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={!exportData}
                onClick={() => handleExport("md")}
              >
                <FileTextIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span>Export as Markdown</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={!exportData}
                onClick={() => handleExport("json")}
              >
                <FileCodeIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span>Export as JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};
