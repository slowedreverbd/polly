import { useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";

import { storeAnonymousUserId } from "./use-user";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";
import { clearConversationCache } from "../lib/conversation-cache";
import { type Attachment, type ConversationId, type UserId } from "../types";

// Interface for createConversation parameters

export type CreateConversationParams = {
  firstMessage: string;
  sourceConversationId?: ConversationId;
  personaId?: Id<"personas"> | null;
  userId?: UserId;
  attachments?: Attachment[];
  useWebSearch?: boolean;
  personaPrompt?: string | null;
  generateTitle?: boolean;
};

// Simplified hook using the single new conversation action

export function useCreateConversation() {
  const createNewConversation = useAction(
    api.conversations.createNewConversation
  );
  const queryClient = useQueryClient();

  const createConversation = async ({
    firstMessage,
    sourceConversationId,
    personaId,
    userId,
    attachments,
    useWebSearch,
    personaPrompt,
    generateTitle = true,
  }: CreateConversationParams) => {
    try {
      const result = await createNewConversation({
        userId,
        firstMessage,
        sourceConversationId,
        personaId: personaId || undefined,
        personaPrompt: personaPrompt || undefined,
        attachments,
        useWebSearch,
        generateTitle,
      });

      // If a new user was created, store the ID in localStorage
      if (result.isNewUser) {
        storeAnonymousUserId(result.userId);
      }

      // Invalidate conversation cache for both TanStack Query
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      // Clear our localStorage cache to force reload from server
      clearConversationCache();

      return result.conversationId;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      const { toast } = await import("sonner");
      toast.error("Failed to create conversation", {
        description: "Unable to start a new conversation. Please try again.",
      });
      throw error;
    }
  };

  // Alias for backward compatibility - both methods do the same thing now
  const createNewConversationWithResponse = createConversation;

  return {
    createNewConversation: createConversation,
    createNewConversationWithResponse,
  };
}

// Utility functions for error handling
export const conversationErrorHandlers = {
  async handleDelete(operation: () => Promise<unknown>) {
    try {
      const result = await operation();
      const { toast } = await import("sonner");
      toast.success("Conversation deleted", {
        description: "The conversation has been permanently removed.",
      });
      return result;
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      const { toast } = await import("sonner");
      toast.error("Failed to delete conversation", {
        description: "Unable to delete conversation. Please try again.",
      });
      throw error;
    }
  },

  async handleShare(operation: () => Promise<unknown>) {
    try {
      return await operation();
    } catch (error) {
      console.error("Failed to share conversation:", error);
      const { toast } = await import("sonner");
      toast.error("Failed to share conversation", {
        description: "Unable to share conversation. Please try again.",
      });
      throw error;
    }
  },
};
