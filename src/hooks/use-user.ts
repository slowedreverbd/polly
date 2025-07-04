import { useEffect, useMemo, useState } from "react";

import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import {
  getStoredAnonymousUserId,
  onAnonymousUserCreated,
  storeAnonymousUserId as storeUserId,
  cleanupAnonymousUserId,
} from "../lib/auth-utils";
import { MONTHLY_MESSAGE_LIMIT } from "../lib/constants";
import {
  clearUserCache,
  getCachedUserData,
  setCachedUser,
} from "../lib/user-cache";
import { type User, type UserId } from "../types";
import { useConvexWithOptimizedCache } from "./use-convex-cache";

// Keep in sync with server-side ANONYMOUS_MESSAGE_LIMIT in convex/users.ts
const ANONYMOUS_MESSAGE_LIMIT = 10;

type UseUserReturn = {
  user: User | null;
  messageCount: number;
  remainingMessages: number;
  isAnonymous: boolean;
  hasMessageLimit: boolean;
  canSendMessage: boolean;
  isLoading: boolean;
  // New fields for authenticated users
  monthlyUsage?: {
    monthlyMessagesSent: number;
    monthlyLimit: number;
    remainingMessages: number;
    resetDate: number | null | undefined;
    needsReset: boolean;
  };
  hasUserApiKeys?: boolean;
  hasUnlimitedCalls?: boolean;
  isHydrated?: boolean;
};

function computeUserProperties({
  user,
  messageCount,
  monthlyUsage,
  hasUserApiKeys,
  hasUserModels,
  isLoading,
}: {
  user: User | null;
  messageCount: number | undefined;
  monthlyUsage:
    | {
        monthlyMessagesSent: number;
        monthlyLimit: number;
        remainingMessages: number;
        resetDate: number | null | undefined;
        needsReset: boolean;
      }
    | null
    | undefined;
  hasUserApiKeys: boolean;
  hasUserModels: boolean;
  isLoading: boolean;
}): Omit<UseUserReturn, "user"> {
  const isAnonymous = !user || user.isAnonymous;
  const effectiveMessageCount = messageCount ?? 0;

  // For anonymous users
  if (isAnonymous) {
    const remainingMessages = Math.max(
      0,
      ANONYMOUS_MESSAGE_LIMIT - effectiveMessageCount
    );
    return {
      messageCount: effectiveMessageCount,
      remainingMessages,
      isAnonymous: true,
      hasMessageLimit: true,
      canSendMessage: remainingMessages > 0,
      isLoading,
      hasUnlimitedCalls: false,
      isHydrated: !isLoading,
    };
  }

  // For authenticated users
  const hasUnlimitedCalls = Boolean(user.hasUnlimitedCalls);
  const monthlyLimit = monthlyUsage?.monthlyLimit ?? MONTHLY_MESSAGE_LIMIT;
  const monthlyMessagesSent = monthlyUsage?.monthlyMessagesSent ?? 0;
  const remainingMessages = hasUnlimitedCalls
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, monthlyLimit - monthlyMessagesSent);

  return {
    messageCount: effectiveMessageCount,
    remainingMessages,
    isAnonymous: false,
    hasMessageLimit: !hasUnlimitedCalls,
    canSendMessage: hasUnlimitedCalls || remainingMessages > 0 || hasUserModels,
    isLoading,
    monthlyUsage: monthlyUsage
      ? {
          monthlyMessagesSent,
          monthlyLimit,
          remainingMessages,
          resetDate: monthlyUsage.resetDate,
          needsReset: monthlyUsage.needsReset,
        }
      : undefined,
    hasUserApiKeys,
    hasUnlimitedCalls,
    isHydrated: !isLoading,
  };
}

// Main unified user hook - works for both authenticated and anonymous users
export function useUserData(): UseUserReturn {
  // Get anonymous user ID from storage for fallback
  const [storedAnonymousUserId, setStoredAnonymousUserId] =
    useState<UserId | null>(() => {
      return getStoredAnonymousUserId();
    });

  // Listen for anonymous user creation event
  useEffect(() => {
    return onAnonymousUserCreated(userId => {
      setStoredAnonymousUserId(userId);
    });
  }, []);

  // Migration helpers
  const initializeMessagesSent = useMutation(api.users.initializeMessagesSent);
  const initializeMonthlyLimits = useMutation(
    api.users.initializeMonthlyLimits
  );

  // Use optimized cache for authenticated user
  const { data: authenticatedUser, isLoading: isLoadingAuth } =
    useConvexWithOptimizedCache(
      api.users.current,
      {},
      {
        queryKey: "currentUser",
        getCachedData: () => getCachedUserData()?.user || null,
        setCachedData: user => {
          if (user) {
            const cached = getCachedUserData();
            setCachedUser(
              user,
              cached?.messageCount,
              cached?.monthlyUsage,
              cached?.hasUserApiKeys
            );
          }
        },
        clearCachedData: clearUserCache,
        invalidationEvents: ["user-graduated"],
      }
    );

  // Use optimized cache for anonymous user
  const { data: anonymousUser, isLoading: isLoadingAnon } =
    useConvexWithOptimizedCache(
      api.users.getById,
      !authenticatedUser && storedAnonymousUserId
        ? { id: storedAnonymousUserId }
        : "skip",
      {
        queryKey: ["anonymousUser", storedAnonymousUserId || ""],
        getCachedData: () => {
          const cached = getCachedUserData();
          return cached?.user?.isAnonymous ? cached.user : null;
        },
        setCachedData: user => {
          if (user?.isAnonymous) {
            const cached = getCachedUserData();
            setCachedUser(
              user,
              cached?.messageCount,
              cached?.monthlyUsage,
              cached?.hasUserApiKeys
            );
          }
        },
        clearCachedData: clearUserCache,
        invalidationEvents: ["user-graduated"],
      }
    );

  // Determine current user
  const currentUser: User | null = useMemo(() => {
    if (authenticatedUser) return authenticatedUser;
    if (anonymousUser && storedAnonymousUserId) return anonymousUser;
    return null;
  }, [authenticatedUser, anonymousUser, storedAnonymousUserId]);

  // Use optimized cache for message count
  const currentUserId = currentUser?._id || null;
  const { data: messageCount, isLoading: isLoadingMessageCount } =
    useConvexWithOptimizedCache(
      api.users.getMessageCount,
      currentUserId ? { userId: currentUserId } : "skip",
      {
        queryKey: ["messageCount", currentUserId || ""],
        getCachedData: () => getCachedUserData()?.messageCount ?? null,
        setCachedData: count => {
          if (currentUser && typeof count === "number") {
            const cached = getCachedUserData();
            setCachedUser(
              currentUser,
              count,
              cached?.monthlyUsage,
              cached?.hasUserApiKeys
            );
          }
        },
        clearCachedData: clearUserCache,
        invalidationEvents: ["user-graduated"],
      }
    );

  // Use optimized cache for monthly usage
  const { data: monthlyUsage, isLoading: isLoadingMonthlyUsage } =
    useConvexWithOptimizedCache(
      api.users.getMonthlyUsage,
      authenticatedUser && !authenticatedUser.isAnonymous
        ? { userId: authenticatedUser._id }
        : "skip",
      {
        queryKey: ["monthlyUsage", authenticatedUser?._id || ""],
        getCachedData: () => getCachedUserData()?.monthlyUsage ?? null,
        setCachedData: usage => {
          if (currentUser && usage) {
            const cached = getCachedUserData();
            setCachedUser(
              currentUser,
              cached?.messageCount,
              usage,
              cached?.hasUserApiKeys
            );
          }
        },
        clearCachedData: clearUserCache,
        invalidationEvents: ["user-graduated"],
      }
    );

  // Use optimized cache for API keys
  const { data: hasUserApiKeys, isLoading: isLoadingApiKeys } =
    useConvexWithOptimizedCache(
      api.users.hasUserApiKeys,
      authenticatedUser && !authenticatedUser.isAnonymous ? {} : "skip",
      {
        queryKey: "hasUserApiKeys",
        getCachedData: () => getCachedUserData()?.hasUserApiKeys ?? null,
        setCachedData: hasKeys => {
          if (currentUser && typeof hasKeys === "boolean") {
            const cached = getCachedUserData();
            setCachedUser(
              currentUser,
              cached?.messageCount,
              cached?.monthlyUsage,
              hasKeys
            );
          }
        },
        clearCachedData: clearUserCache,
        invalidationEvents: ["user-graduated"],
      }
    );

  const { data: hasUserModels, isLoading: isLoadingUserModels } =
    useConvexWithOptimizedCache(
      api.userModels.hasUserModels,
      authenticatedUser && !authenticatedUser.isAnonymous ? {} : "skip",
      {
        queryKey: "hasUserModels",
        getCachedData: () => getCachedUserData()?.hasUserModels ?? null,
        setCachedData: hasModels => {
          if (currentUser && typeof hasModels === "boolean") {
            const cached = getCachedUserData();
            setCachedUser(
              currentUser,
              cached?.messageCount,
              cached?.monthlyUsage,
              cached?.hasUserApiKeys
            );
          }
        },
        clearCachedData: clearUserCache,
        invalidationEvents: ["user-graduated"],
      }
    );

  // Handle user graduation event cleanup
  useEffect(() => {
    const handleGraduationComplete = () => {
      setStoredAnonymousUserId(null);
      clearUserCache();
      cleanupAnonymousUserId();
    };

    window.addEventListener("user-graduated", handleGraduationComplete);
    return () => {
      window.removeEventListener("user-graduated", handleGraduationComplete);
    };
  }, []);

  // Detect user graduation (transition from anonymous to authenticated)
  useEffect(() => {
    const wasAnonymous = storedAnonymousUserId !== null;
    const isNowAuthenticated =
      authenticatedUser && !authenticatedUser.isAnonymous;

    if (wasAnonymous && isNowAuthenticated) {
      // User has graduated from anonymous to authenticated
      const event = new CustomEvent("user-graduated");
      window.dispatchEvent(event);
    }
  }, [storedAnonymousUserId, authenticatedUser]);

  // Initialize missing data
  useEffect(() => {
    if (currentUser && currentUser.messagesSent === undefined) {
      initializeMessagesSent({ userId: currentUser._id });
    }
  }, [currentUser, initializeMessagesSent]);

  useEffect(() => {
    if (currentUser && !currentUser.isAnonymous) {
      initializeMonthlyLimits({ userId: currentUser._id });
    }
  }, [currentUser, initializeMonthlyLimits]);

  // Determine loading state
  const isLoading = useMemo(() => {
    // Always loading if auth is still loading
    if (isLoadingAuth) {
      return true;
    }

    // Loading if we expect an anonymous user but it's still loading
    if (!authenticatedUser && storedAnonymousUserId && isLoadingAnon) {
      return true;
    }

    // Loading if we have a user but message count is still loading
    if (currentUserId && isLoadingMessageCount) {
      return true;
    }

    // For authenticated (non-anonymous) users, check additional data
    const isAuthenticatedUser =
      authenticatedUser && !authenticatedUser.isAnonymous;

    if (isAuthenticatedUser) {
      return isLoadingMonthlyUsage || isLoadingApiKeys || isLoadingUserModels;
    }

    return false;
  }, [
    isLoadingAuth,
    isLoadingAnon,
    isLoadingMessageCount,
    isLoadingMonthlyUsage,
    isLoadingApiKeys,
    isLoadingUserModels,
    authenticatedUser,
    storedAnonymousUserId,
    currentUserId,
  ]);

  const userProperties = useMemo(
    () =>
      computeUserProperties({
        user: currentUser,
        messageCount: messageCount ?? undefined,
        monthlyUsage,
        hasUserApiKeys,
        hasUserModels,
        isLoading,
      }),
    [
      currentUser,
      messageCount,
      monthlyUsage,
      hasUserApiKeys,
      hasUserModels,
      isLoading,
    ]
  );

  return {
    user: currentUser,
    ...userProperties,
  };
}

export function usePreloadedUser(
  preloadedUser: Preloaded<typeof api.users.getById>,
  preloadedMessageCount: Preloaded<typeof api.users.getMessageCount>,
  preloadedMonthlyUsage: Preloaded<typeof api.users.getMonthlyUsage>,
  preloadedHasUserApiKeys: Preloaded<typeof api.users.hasUserApiKeys>,
  preloadedHasUserModels: Preloaded<typeof api.userModels.hasUserModels>
): UseUserReturn {
  const user = usePreloadedQuery(preloadedUser);
  const messageCount = usePreloadedQuery(preloadedMessageCount);
  const monthlyUsage = usePreloadedQuery(preloadedMonthlyUsage);
  const hasUserApiKeys = usePreloadedQuery(preloadedHasUserApiKeys);
  const hasUserModels = usePreloadedQuery(preloadedHasUserModels);

  const initializeMessagesSent = useMutation(api.users.initializeMessagesSent);

  useEffect(() => {
    if (user && user.messagesSent === undefined) {
      initializeMessagesSent({ userId: user._id });
    }
  }, [user, initializeMessagesSent]);

  const userProperties = useMemo(
    () =>
      computeUserProperties({
        user,
        messageCount,
        monthlyUsage,
        hasUserApiKeys,
        hasUserModels,
        isLoading: false,
      }),
    [user, messageCount, monthlyUsage, hasUserApiKeys, hasUserModels]
  );

  return {
    user,
    ...userProperties,
  };
}

// Main hook alias for backward compatibility
export function useUser() {
  return useUserData();
}

// Helper function for storing anonymous user ID
export const storeAnonymousUserId = storeUserId;
