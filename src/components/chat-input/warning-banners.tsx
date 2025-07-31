import { useCallback, useMemo, useState } from "react";
import { ChatWarningBanner } from "@/components/ui/chat-warning-banner";
import { useUserDataContext } from "@/providers/user-data-context";

type WarningMessage = {
  text: string;
  link?: { text: string; href: string };
  suffix?: string;
};

type WarningState = {
  type: "warning" | "error";
  message: WarningMessage;
  isDismissed: boolean;
} | null;

interface WarningBannersProps {
  hasExistingMessages?: boolean;
}

export function WarningBanners({ hasExistingMessages }: WarningBannersProps) {
  const {
    hasMessageLimit,
    canSendMessage,
    monthlyUsage,
    hasUserApiKeys,
    hasUnlimitedCalls,
    user,
  } = useUserDataContext();

  const isNoUser = user === null;

  const [dismissedWarning, setDismissedWarning] = useState<string | null>(null);

  const warningState = useMemo((): WarningState => {
    if (isNoUser) {
      return null;
    }

    // If user has unlimited calls, no warning needed
    if (hasUnlimitedCalls) {
      return null;
    }

    // If no message limit, no warning needed
    if (!hasMessageLimit) {
      return null;
    }

    const remainingMessages = monthlyUsage?.remainingMessages ?? 0;
    const isLimitReached = !canSendMessage;
    const warningKey = isLimitReached ? "limit-reached" : "limit-warning";

    // Check if this specific warning is dismissed
    if (dismissedWarning === warningKey) {
      return null;
    }

    // Limit reached (error state)
    if (isLimitReached) {
      if (user?.isAnonymous) {
        return {
          type: "error",
          message: {
            text: "Message limit reached.",
            link: { text: "Sign in", href: "/auth" },
            suffix: "to continue chatting without limits.",
          },
          isDismissed: false,
        };
      }
      return {
        type: "error",
        message: {
          text: "Monthly Polly model limit reached.",
          suffix: hasUserApiKeys
            ? "Use your BYOK models to continue chatting."
            : "Add API keys to access BYOK models.",
        },
        isDismissed: false,
      };
    }

    // Limit warning (warning state) - only show if remaining messages < 10
    if (remainingMessages < 10 && remainingMessages > 0) {
      if (user?.isAnonymous) {
        return {
          type: "warning",
          message: {
            text: `${remainingMessages} message${
              remainingMessages === 1 ? "" : "s"
            } remaining.`,
            link: { text: "Sign in", href: "/auth" },
            suffix: " for higher limits.",
          },
          isDismissed: false,
        };
      }
      return {
        type: "warning",
        message: {
          text: `${remainingMessages} monthly message${
            remainingMessages === 1 ? "" : "s"
          } remaining. `,
          suffix: hasUserApiKeys
            ? "Use BYOK models for unlimited chats."
            : "Add API keys for unlimited chats.",
        },
        isDismissed: false,
      };
    }

    return null;
  }, [
    isNoUser,
    hasMessageLimit,
    canSendMessage,
    hasUnlimitedCalls,
    monthlyUsage,
    hasUserApiKeys,
    user?.isAnonymous,
    dismissedWarning,
  ]);

  const dismissWarning = useCallback(() => {
    if (warningState) {
      const warningKey =
        warningState.type === "error" ? "limit-reached" : "limit-warning";
      setDismissedWarning(warningKey);
    }
  }, [warningState]);

  if (!warningState) {
    return null;
  }

  if (!hasExistingMessages) {
    return (
      <div className="flex justify-center h-7 mb-3 transition-opacity duration-200">
        <ChatWarningBanner
          type={warningState.type}
          message={warningState.message}
          onDismiss={dismissWarning}
          variant="stable"
        />
      </div>
    );
  }

  return (
    <ChatWarningBanner
      type={warningState.type}
      message={warningState.message}
      onDismiss={dismissWarning}
      variant="floating"
    />
  );
}
