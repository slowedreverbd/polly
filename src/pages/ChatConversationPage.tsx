import { useNavigate, useParams } from "react-router";

import { useQuery } from "convex/react";

import { ConversationChatView } from "@/components/conversation-chat-view";
import { NotFoundPage } from "@/components/ui/not-found-page";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import { ROUTES } from "@/lib/routes";
import { type ConversationId } from "@/types";

import { api } from "../../convex/_generated/api";

export default function ConversationRoute() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useUser();

  if (!conversationId) {
    throw new Error("Conversation ID is required");
  }

  // Query conversation even while user is loading (will be skipped until user is available)
  const conversation = useQuery(
    api.conversations.getAuthorized,
    user?._id ? { id: conversationId, userId: user._id } : "skip"
  );

  const hasApiKeys = useQuery(api.apiKeys.hasAnyApiKey, {});

  const {
    messages: chatMessages,
    isLoading: isGenerating,
    isLoadingMessages,
    sendMessage,
    sendMessageToNewConversation,
    editMessage,
    retryUserMessage,
    retryAssistantMessage,
    deleteMessage,
    stopGeneration,
    isStreaming,
  } = useChat({
    conversationId: conversationId as ConversationId,
    onError: error => console.error("Chat error:", error),
    onConversationCreate: (newConversationId: ConversationId) => {
      navigate(ROUTES.CHAT_CONVERSATION(newConversationId));
    },
  });

  // If user is loaded and the query has completed and conversation is null,
  // It means either the conversation doesn't exist or user doesn't have access
  if (!userLoading && conversation === null) {
    return <NotFoundPage />;
  }

  return (
    <ConversationChatView
      conversationId={conversationId as ConversationId}
      hasApiKeys={hasApiKeys ?? false}
      isLoading={isGenerating}
      isLoadingMessages={isLoadingMessages || userLoading}
      isStreaming={isStreaming}
      messages={chatMessages || []}
      onDeleteMessage={deleteMessage}
      onEditMessage={editMessage}
      onRetryAssistantMessage={retryAssistantMessage}
      onRetryUserMessage={retryUserMessage}
      onSendMessage={sendMessage}
      onSendMessageToNewConversation={sendMessageToNewConversation}
      onStopGeneration={stopGeneration}
    />
  );
}
