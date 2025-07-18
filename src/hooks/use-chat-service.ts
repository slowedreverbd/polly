import type { Id } from "@convex/_generated/dataModel";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { usePrivateMode } from "@/contexts/private-mode-context";
import { ROUTES } from "@/lib/routes";
import { useThinking } from "@/providers/thinking-provider";
import type {
  Attachment,
  ChatMessage,
  ChatMode,
  ConversationId,
  CreateConversationParams,
  ReasoningConfig,
} from "@/types";
import { useChatStateMachine } from "./use-chat-state-machine";
import { usePrivateChat } from "./use-private-chat";
import { useServerChat } from "./use-server-chat";

interface ChatServiceOptions {
  conversationId?: ConversationId;
  onError?: (error: Error) => void;
  onConversationCreate?: (conversationId: ConversationId) => void;
  initialPersonaId?: Id<"personas">;
  initialReasoningConfig?: ReasoningConfig;
  overrideMode?: ChatMode;
}

interface ChatService {
  // State
  mode: ChatMode;
  messages: ChatMessage[];
  currentPersonaId: Id<"personas"> | null;
  currentReasoningConfig?: ReasoningConfig;

  // State machine properties
  isIdle: boolean;
  isSending: boolean;
  isStreaming: boolean;
  hasError: boolean;
  isStopped: boolean;
  isActive: boolean;
  error: Error | null;
  canRetry: boolean;

  isLoading: boolean;
  isLoadingMessages: boolean;

  // Actions
  sendMessage: (
    content: string,
    attachments?: Attachment[],
    personaId?: Id<"personas"> | null,
    reasoningConfig?: ReasoningConfig
  ) => Promise<void>;
  sendMessageToNewConversation: (
    content: string,
    shouldNavigate?: boolean,
    attachments?: Attachment[],
    contextSummary?: string,
    sourceConversationId?: ConversationId,
    personaId?: Id<"personas"> | null,
    reasoningConfig?: ReasoningConfig
  ) => Promise<ConversationId | undefined>;
  createConversation: (
    params: CreateConversationParams
  ) => Promise<ConversationId>;
  stopGeneration: () => void;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  retryUserMessage: (
    messageId: string,
    reasoningConfig?: ReasoningConfig
  ) => Promise<void>;
  retryAssistantMessage: (
    messageId: string,
    reasoningConfig?: ReasoningConfig
  ) => Promise<void>;
  toggleMode: () => void;

  // For compatibility
  conversationId?: ConversationId;
}

export function useChatService({
  conversationId,
  onError,
  onConversationCreate,
  initialPersonaId,
  initialReasoningConfig,
  overrideMode,
}: ChatServiceOptions): ChatService {
  const navigate = useNavigate();
  const { setIsThinking } = useThinking();
  const { isPrivateMode, togglePrivateMode } = usePrivateMode();

  // Use override mode if provided, otherwise use context
  const mode: ChatMode =
    overrideMode ?? (isPrivateMode ? "private" : "regular");

  // Initialize chat state machine
  const chatStateMachine = useChatStateMachine();

  // Initialize both chat services
  const serverChat = useServerChat({
    conversationId,
    onError,
    onConversationCreate,
  });

  const privateChat = usePrivateChat({
    onError,
    setIsThinking,
    initialPersonaId,
    initialReasoningConfig,
  });

  // Determine which service to use based on mode
  const activeService = mode === "private" ? privateChat : serverChat;

  // Unified message handling with state machine integration
  const sendMessage = useCallback(
    async (
      content: string,
      attachments?: Attachment[],
      personaId?: Id<"personas"> | null,
      reasoningConfig?: ReasoningConfig
    ) => {
      // Generate message ID for state tracking
      const messageId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      try {
        chatStateMachine.actions.sendMessage(messageId);

        if (mode === "private") {
          await privateChat.sendMessage({
            content,
            attachments,
            personaId,
            reasoningConfig,
          });
        } else {
          await serverChat.sendMessage(
            content,
            attachments,
            personaId,
            reasoningConfig
          );
        }

        chatStateMachine.actions.endStreaming();
      } catch (error) {
        chatStateMachine.actions.setError(error as Error);
        throw error;
      }
    },
    [mode, privateChat, serverChat, chatStateMachine.actions]
  );

  // Unified stop generation
  const stopGeneration = useCallback(() => {
    if (mode === "private") {
      privateChat.stopGeneration();
    } else {
      serverChat.stopGeneration();
    }
    chatStateMachine.actions.stopGeneration();
  }, [mode, privateChat, serverChat, chatStateMachine.actions]);

  // Unified delete message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (mode === "private") {
        await privateChat.deleteMessage(messageId);
      } else {
        await serverChat.deleteMessage(messageId);
      }
    },
    [mode, privateChat, serverChat]
  );

  // Unified edit message
  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (mode === "private") {
        await privateChat.editMessage(messageId, content);
      } else {
        await serverChat.editMessage(messageId, content);
      }
    },
    [mode, serverChat, privateChat]
  );

  // Unified retry functions
  const retryUserMessage = useCallback(
    async (messageId: string, reasoningConfig?: ReasoningConfig) => {
      if (mode === "private") {
        await privateChat.retryUserMessage(messageId);
      } else {
        await serverChat.retryUserMessage(messageId, reasoningConfig);
      }
    },
    [mode, serverChat, privateChat]
  );

  const retryAssistantMessage = useCallback(
    async (messageId: string, reasoningConfig?: ReasoningConfig) => {
      if (mode === "private") {
        await privateChat.retryAssistantMessage(messageId);
      } else {
        await serverChat.retryAssistantMessage(messageId, reasoningConfig);
      }
    },
    [mode, serverChat, privateChat]
  );

  // Mode toggle with navigation
  const toggleMode = useCallback(() => {
    const currentPersonaId = initialPersonaId; // This could be tracked in state

    togglePrivateMode();

    if (mode === "private") {
      if (privateChat.messages.length > 0) {
        navigate(ROUTES.HOME, {
          state: {
            fromPrivateMode: true,
            privateMessages: privateChat.messages,
            personaId: currentPersonaId,
          },
        });
      } else {
        navigate(ROUTES.HOME);
      }
    } else {
      navigate(ROUTES.PRIVATE_CHAT, {
        state: {
          fromRegularMode: true,
          personaId: currentPersonaId,
        },
      });
    }
  }, [
    mode,
    navigate,
    initialPersonaId,
    togglePrivateMode,
    privateChat.messages,
  ]);

  // Memoize the service object
  return useMemo(
    () => ({
      // State
      mode,
      messages: activeService.messages,
      currentPersonaId:
        mode === "private"
          ? privateChat.currentPersonaId
          : initialPersonaId || null,
      currentReasoningConfig:
        mode === "private" ? privateChat.currentReasoningConfig : undefined,

      // State machine properties
      isIdle: chatStateMachine.isIdle,
      isSending: chatStateMachine.isSending,
      isStreaming:
        Boolean(chatStateMachine.isStreaming) ||
        Boolean(activeService.isStreaming),
      hasError: chatStateMachine.hasError,
      isStopped: chatStateMachine.isStopped,
      isActive: chatStateMachine.isActive,
      error: chatStateMachine.error,
      canRetry: chatStateMachine.canRetry,

      isLoading: activeService.isLoading || chatStateMachine.isActive,
      isLoadingMessages: mode === "private" ? false : serverChat.isLoading,

      // Actions
      sendMessage,
      sendMessageToNewConversation: serverChat.sendMessageToNewConversation,
      createConversation: serverChat.createConversation,
      stopGeneration,
      deleteMessage,
      editMessage,
      retryUserMessage,
      retryAssistantMessage,
      toggleMode,

      // For compatibility
      conversationId,
    }),
    [
      mode,
      activeService.messages,
      activeService.isLoading,
      activeService.isStreaming,
      privateChat.currentPersonaId,
      initialPersonaId,
      privateChat.currentReasoningConfig,
      chatStateMachine.isIdle,
      chatStateMachine.isSending,
      chatStateMachine.isStreaming,
      chatStateMachine.hasError,
      chatStateMachine.isStopped,
      chatStateMachine.isActive,
      chatStateMachine.error,
      chatStateMachine.canRetry,
      serverChat.isLoading,
      serverChat.sendMessageToNewConversation,
      serverChat.createConversation,
      sendMessage,
      stopGeneration,
      deleteMessage,
      editMessage,
      retryUserMessage,
      retryAssistantMessage,
      toggleMode,
      conversationId,
    ]
  );
}
