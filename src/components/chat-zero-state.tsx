import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  CheckCircleIcon,
  CircleIcon,
  KeyIcon,
  LightningIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChatInput, type ChatInputRef } from "@/components/chat-input";
import { Button } from "@/components/ui/button";
import { useModelSelection } from "@/lib/chat/use-model-selection";
import { CACHE_KEYS, get as getLS, set as setLS } from "@/lib/local-storage";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { usePrivateMode } from "@/providers/private-mode-context";
import { useUserDataContext } from "@/providers/user-data-context";
import type { Attachment, ReasoningConfig } from "@/types";
import { SimplePrompts } from "./prompts-ticker";

const SetupChecklist = () => {
  const { hasUserApiKeys, hasUserModels, user } = useUserDataContext();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = getLS<boolean>(CACHE_KEYS.setupChecklistDismissed, false);
    setIsDismissed(dismissed);
  }, []);

  const handleDismiss = () => {
    setLS<boolean>(CACHE_KEYS.setupChecklistDismissed, true);
    setIsDismissed(true);
  };

  const isAnonymous = user?.isAnonymous ?? true;
  if (isAnonymous || isDismissed || (hasUserApiKeys && hasUserModels)) {
    return null;
  }

  return (
    <div className="mx-auto mt-2 max-w-sm sm:mt-4 sm:max-w-md">
      <div
        aria-live="polite"
        className="relative rounded-md border border-border/30 bg-muted/20 p-2.5"
      >
        <Button
          aria-label="Dismiss checklist"
          className="absolute right-1.5 top-1.5 h-5 w-5 p-0 hover:bg-muted/50"
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
        >
          <XIcon className="h-2.5 w-2.5" />
        </Button>
        <div className="pr-6">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            Next Steps
          </h3>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-left">
              {hasUserApiKeys ? (
                <CheckCircleIcon className="h-3 w-3 shrink-0 text-success" />
              ) : (
                <CircleIcon className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              )}
              <span
                className={cn(
                  "flex-1 text-muted-foreground transition-colors text-left",
                  hasUserApiKeys && "opacity-60"
                )}
              >
                Add your API keys
              </span>
              {!hasUserApiKeys && (
                <Link to={ROUTES.SETTINGS.API_KEYS}>
                  <Button
                    className="gap-1 bg-background/50 text-xs"
                    size="sm"
                    variant="outline"
                  >
                    <KeyIcon className="h-3 w-3" />
                    Go to API Keys
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-left">
              {hasUserModels ? (
                <CheckCircleIcon className="h-3 w-3 shrink-0 text-success" />
              ) : (
                <CircleIcon className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              )}
              <span
                className={cn(
                  "flex-1 text-muted-foreground transition-colors text-left",
                  hasUserModels && "opacity-60"
                )}
              >
                Enable AI models
              </span>
              {hasUserApiKeys && !hasUserModels && (
                <Link to={ROUTES.SETTINGS.MODELS}>
                  <Button
                    className="gap-1 bg-background/50 text-xs"
                    size="sm"
                    variant="outline"
                  >
                    <LightningIcon className="h-3 w-3" />
                    View Models
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatSection = () => {
  const {
    canSendMessage,
    hasMessageLimit,
    hasUnlimitedCalls,
    monthlyUsage,
    user,
  } = useUserDataContext();
  const { selectedModel } = useModelSelection();
  const isLoading = !user;
  const chatInputRef = useRef<ChatInputRef>(null);
  const createConversationAction = useAction(
    api.conversations.createConversationAction
  );
  const navigate = useNavigate();
  const { isPrivateMode } = usePrivateMode();

  const handleSendMessage = useCallback(
    async (
      content: string,
      attachments?: Attachment[],
      personaId?: Id<"personas"> | null,
      reasoningConfig?: ReasoningConfig,
      temperature?: number
    ) => {
      if (isPrivateMode) {
        navigate(ROUTES.PRIVATE_CHAT, {
          state: {
            initialMessage: content,
            attachments,
            personaId,
            reasoningConfig,
            temperature,
          },
        });
        return;
      }

      const result = await createConversationAction({
        firstMessage: content,
        title: "New Conversation",
        attachments,
        personaId: personaId ?? undefined,
        reasoningConfig: reasoningConfig
          ? {
              enabled: reasoningConfig.enabled,
              effort: reasoningConfig.effort || "medium",
              maxTokens: reasoningConfig.maxTokens,
            }
          : undefined,
        model: selectedModel?.modelId,
        provider: selectedModel?.provider,
        temperature,
      });

      if (result?.conversationId) {
        navigate(ROUTES.CHAT_CONVERSATION(result.conversationId));
      }
    },
    [navigate, isPrivateMode, createConversationAction, selectedModel]
  );

  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      handleSendMessage(prompt);
    },
    [handleSendMessage]
  );

  const hasWarning = useMemo(() => {
    const remaining = monthlyUsage?.remainingMessages ?? 0;
    const showLimitWarning =
      hasMessageLimit && remaining > 0 && canSendMessage && !hasUnlimitedCalls;
    const showLimitReached =
      hasMessageLimit && !canSendMessage && !hasUnlimitedCalls;
    return showLimitWarning || showLimitReached;
  }, [
    hasMessageLimit,
    canSendMessage,
    hasUnlimitedCalls,
    monthlyUsage?.remainingMessages,
  ]);

  const chatInputProps = {
    hasExistingMessages: false,
    isLoading: false,
    isStreaming: false,
    onStop: () => undefined,
    onSendMessage: handleSendMessage,
  };

  return (
    <div className="relative">
      <SimplePrompts
        hasReachedLimit={!canSendMessage}
        hasWarning={hasWarning}
        isAnonymous={user?.isAnonymous ?? true}
        userLoading={isLoading}
        onQuickPrompt={handleQuickPrompt}
      />
      <ChatInput ref={chatInputRef} {...chatInputProps} />
    </div>
  );
};

export const ChatZeroState = () => {
  return (
    <div className="flex h-full w-full max-w-full flex-col overflow-hidden sm:flex sm:h-full sm:items-center sm:justify-center">
      <div className="mx-auto flex h-full w-full min-w-0 flex-col sm:block sm:h-auto">
        <div className="flex flex-1 flex-col items-center justify-center sm:hidden">
          <div className="space-y-4 text-center">
            <div className="flex justify-center mb-3">
              <div className="relative">
                <img
                  alt="Polly AI Mascot"
                  className="w-28 h-28 relative z-10 object-contain drop-shadow-lg"
                  loading="eager"
                  src="/polly-mascot.png"
                />
                <div className="absolute inset-0 scale-110 rounded-full bg-gradient-to-br from-accent-coral/15 via-accent-orange/15 to-accent-yellow/15 opacity-50 blur-lg" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              What&apos;s on your mind?
            </h1>
          </div>
        </div>

        <div className="hidden max-w-full space-y-4 text-center sm:block sm:space-y-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-center mb-2 sm:mb-3">
              <div className="relative">
                <img
                  alt="Polly AI Mascot"
                  className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 object-contain drop-shadow-lg"
                  loading="eager"
                  src="/polly-mascot.png"
                />
                <div className="absolute inset-0 scale-110 rounded-full bg-gradient-to-br from-accent-coral/15 via-accent-orange/15 to-accent-yellow/15 opacity-50 blur-lg" />
              </div>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
              What&apos;s on your mind?
            </h1>
          </div>

          <ChatSection />

          <SetupChecklist />
        </div>

        <div className="flex-shrink-0 space-y-4 sm:hidden">
          <SetupChecklist />
          <ChatSection />
        </div>
      </div>
    </div>
  );
};
