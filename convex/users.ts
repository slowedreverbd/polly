import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { ANONYMOUS_MESSAGE_LIMIT, MONTHLY_MESSAGE_LIMIT } from "./constants";
import { getCurrentUserId } from "./lib/auth";

export const current = query({
  args: {},
  handler: async ctx => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async ctx => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

// Debug query to check user profile data
export const getUserProfile = query({
  args: {},
  handler: async ctx => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Return profile data for debugging
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      isAnonymous: user.isAnonymous,
      createdAt: user.createdAt,
      hasImage: Boolean(user.image),
    };
  },
});

export const createAnonymous = mutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      name: `Anonymous User`,
      email: `anonymous-${now}@temp.local`,
      isAnonymous: true,
      messagesSent: 0,
      createdAt: now,
    });
  },
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getMessageCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return 0;
    }

    // Return the total messages sent counter (not current message count)
    return user.messagesSent || 0;
  },
});

// Get monthly usage statistics for authenticated users
export const getMonthlyUsage = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let userId = args.userId;
    if (!userId) {
      const currentUserId = await getCurrentUserId(ctx);
      if (!currentUserId) {
        return null;
      }
      userId = currentUserId;
    }

    const user = await ctx.db.get(userId);
    if (!user || user.isAnonymous) {
      return null;
    }

    // Return unlimited usage for users with unlimited calls
    if (user.hasUnlimitedCalls) {
      return {
        monthlyMessagesSent: user.monthlyMessagesSent || 0,
        monthlyLimit: -1, // -1 indicates unlimited
        remainingMessages: -1, // -1 indicates unlimited
        resetDate: null,
        needsReset: false,
        hasUnlimitedCalls: true,
      };
    }

    // Check if we need to reset monthly count
    const now = Date.now();
    const createdAt = user.createdAt || now;
    const lastReset = user.lastMonthlyReset || createdAt;

    // Calculate next reset date based on user's creation anniversary
    const lastResetDate = new Date(lastReset);
    const currentDate = new Date(now);

    // Find the next monthly anniversary
    const nextResetDate = new Date(lastResetDate);
    nextResetDate.setMonth(nextResetDate.getMonth() + 1);

    // If we've passed the reset date, we need to reset
    const needsReset = currentDate >= nextResetDate;

    const monthlyLimit = user.monthlyLimit || MONTHLY_MESSAGE_LIMIT;
    let monthlyMessagesSent = user.monthlyMessagesSent || 0;

    if (needsReset) {
      monthlyMessagesSent = 0;
    }

    return {
      monthlyMessagesSent,
      monthlyLimit,
      remainingMessages: Math.max(0, monthlyLimit - monthlyMessagesSent),
      resetDate: nextResetDate.getTime(),
      needsReset,
    };
  },
});

// Check if user has access to BYOK models (has API keys)
export const hasUserApiKeys = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = args.userId || (await getCurrentUserId(ctx));
    if (!userId) {
      return false;
    }

    const apiKeys = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    return apiKeys.length > 0;
  },
});

// Message limit enforcement - using constants from ./constants.ts

export const incrementMessageCount = mutation({
  args: {
    userId: v.id("users"),
    modelProvider: v.optional(v.string()),
    isPollyProvided: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.isAnonymous) {
      // Anonymous users: increment total message count
      const currentCount = user.messagesSent || 0;
      await ctx.db.patch(args.userId, {
        messagesSent: currentCount + 1,
      });
    } else {
      // Authenticated users: only increment monthly count for Polly-provided models
      // Use explicit flag if provided, otherwise assume Polly-provided for backward compatibility
      if (args.isPollyProvided !== false) {
        const now = Date.now();
        const createdAt = user.createdAt || now;
        const lastReset = user.lastMonthlyReset || createdAt;

        // Calculate if we need to reset
        const lastResetDate = new Date(lastReset);
        const currentDate = new Date(now);
        const nextResetDate = new Date(lastResetDate);
        nextResetDate.setMonth(nextResetDate.getMonth() + 1);

        const needsReset = currentDate >= nextResetDate;

        if (needsReset) {
          // Reset monthly count
          await ctx.db.patch(args.userId, {
            monthlyMessagesSent: 1,
            lastMonthlyReset: now,
            monthlyLimit: user.monthlyLimit || MONTHLY_MESSAGE_LIMIT,
          });
        } else {
          // Increment monthly count
          const currentMonthlyCount = user.monthlyMessagesSent || 0;
          await ctx.db.patch(args.userId, {
            monthlyMessagesSent: currentMonthlyCount + 1,
            monthlyLimit: user.monthlyLimit || MONTHLY_MESSAGE_LIMIT,
          });
        }
      }
    }
  },
});

export const enforceMessageLimit = mutation({
  args: {
    userId: v.id("users"),
    modelProvider: v.optional(v.string()),
    isPollyProvided: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.hasUnlimitedCalls) {
      return;
    }

    if (user.isAnonymous) {
      // Anonymous users: enforce 10 message limit
      const messagesSent = user.messagesSent || 0;
      if (messagesSent >= ANONYMOUS_MESSAGE_LIMIT) {
        throw new Error(
          `Message limit reached (${ANONYMOUS_MESSAGE_LIMIT} messages). Authentication is not available - you cannot send more messages.`
        );
      }
    } else {
      // Authenticated users: only enforce limits for Polly-provided models
      // Use explicit flag if provided, otherwise assume Polly-provided for backward compatibility

      // Only enforce limits for Polly-provided model messages
      if (args.isPollyProvided !== false) {
        const now = Date.now();
        const createdAt = user.createdAt || now;
        const lastReset = user.lastMonthlyReset || createdAt;

        // Calculate if we need to reset
        const lastResetDate = new Date(lastReset);
        const currentDate = new Date(now);
        const nextResetDate = new Date(lastResetDate);
        nextResetDate.setMonth(nextResetDate.getMonth() + 1);

        const needsReset = currentDate >= nextResetDate;
        const monthlyLimit = user.monthlyLimit || MONTHLY_MESSAGE_LIMIT;
        let monthlyMessagesSent = user.monthlyMessagesSent || 0;

        if (needsReset) {
          monthlyMessagesSent = 0;
        }

        // Check if they've hit the monthly limit for Polly models
        if (monthlyMessagesSent >= monthlyLimit) {
          throw new Error(
            `Monthly Polly model limit reached (${monthlyLimit} messages). Switch to your BYOK models for unlimited usage, or wait for next month's reset.`
          );
        }
      }
      // BYOK messages have no limits - always allowed
    }
  },
});

export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: (_ctx, _args) => {
    throw new Error("User updates are not available without authentication");
  },
});

export const ensureUser = mutation({
  args: {},
  handler: async ctx => {
    // Get or create the mock user
    const userId = await getCurrentUserId(ctx);
    return userId;
  },
});

// Migration helper to initialize messagesSent for existing users
export const initializeMessagesSent = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return;
    }

    // Only initialize if not already set
    if (user.messagesSent === undefined) {
      await ctx.db.patch(args.userId, {
        messagesSent: 0,
      });
    }
  },
});

// Initialize monthly limits for existing authenticated users
export const initializeMonthlyLimits = mutation({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let userId = args.userId;
    if (!userId) {
      const currentUserId = await getCurrentUserId(ctx);
      if (!currentUserId) {
        return;
      }
      userId = currentUserId;
    }

    const user = await ctx.db.get(userId);
    if (!user || user.isAnonymous) {
      return;
    }

    // Initialize monthly limits if not already set
    const updates: Record<string, number> = {};

    if (user.monthlyLimit === undefined) {
      updates.monthlyLimit = MONTHLY_MESSAGE_LIMIT;
    }

    if (user.monthlyMessagesSent === undefined) {
      updates.monthlyMessagesSent = 0;
    }

    if (user.lastMonthlyReset === undefined) {
      updates.lastMonthlyReset = user.createdAt || Date.now();
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates);
    }
  },
});

// Set unlimited calls flag for a user
export const setUnlimitedCalls = mutation({
  args: {
    userId: v.id("users"),
    hasUnlimitedCalls: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      hasUnlimitedCalls: args.hasUnlimitedCalls,
    });

    return { success: true };
  },
});

// Get user statistics including conversation count and message count
export const getUserStats = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let userId = args.userId;
    if (!userId) {
      const currentUserId = await getCurrentUserId(ctx);
      if (!currentUserId) {
        return null;
      }
      userId = currentUserId;
    }

    const user = await ctx.db.get(userId);
    if (!user || user.isAnonymous) {
      return null;
    }

    // Get conversation count
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    // Get total message count (across all conversations)
    let totalMessages = 0;
    for (const conversation of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", q =>
          q.eq("conversationId", conversation._id)
        )
        .collect();
      totalMessages += messages.length;
    }

    return {
      userId,
      name: user.name,
      email: user.email,
      image: user.image,
      joinedAt: user.createdAt || Date.now(),
      conversationCount: conversations.length,
      totalMessages,
      messagesSent: user.messagesSent || 0, // For anonymous users
    };
  },
});

export const graduateOrMergeAnonymousUser = mutation({
  args: {
    anonymousUserId: v.id("users"),
    authenticatedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const anonymousUser = await ctx.db.get(args.anonymousUserId);
    const authenticatedUser = await ctx.db.get(args.authenticatedUserId);

    if (!anonymousUser || !authenticatedUser) {
      throw new Error("User not found");
    }

    if (!anonymousUser.isAnonymous) {
      throw new Error("User is not anonymous");
    }

    // Check if authenticated user has any existing conversations
    const existingConversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", q => q.eq("userId", args.authenticatedUserId))
      .collect();

    if (existingConversations.length === 0) {
      // Case 1: First time sign in - Graduate the anonymous user
      // Graduating anonymous user to authenticated user

      // Update all conversations from anonymous to authenticated user
      const anonymousConversations = await ctx.db
        .query("conversations")
        .withIndex("by_user", q => q.eq("userId", args.anonymousUserId))
        .collect();

      for (const conversation of anonymousConversations) {
        await ctx.db.patch(conversation._id, {
          userId: args.authenticatedUserId,
        });
      }

      // Copy over message count and monthly usage data
      const anonymousMessageCount = anonymousUser.messagesSent || 0;
      const authenticatedMessageCount = authenticatedUser.messagesSent || 0;

      await ctx.db.patch(args.authenticatedUserId, {
        messagesSent: authenticatedMessageCount + anonymousMessageCount,
        // For monthly usage, add the anonymous messages to the current month
        monthlyMessagesSent:
          (authenticatedUser.monthlyMessagesSent || 0) + anonymousMessageCount,
      });

      // Delete the anonymous user
      await ctx.db.delete(args.anonymousUserId);

      return { action: "graduated" as const };
    }
    // Case 2: Existing user who created anonymous conversations - Merge

    // Transfer all conversations from anonymous to authenticated user
    const anonymousConversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", q => q.eq("userId", args.anonymousUserId))
      .collect();

    for (const conversation of anonymousConversations) {
      await ctx.db.patch(conversation._id, {
        userId: args.authenticatedUserId,
      });
    }

    // Update message count and monthly usage
    const anonymousMessageCount = anonymousUser.messagesSent || 0;
    const authenticatedMessageCount = authenticatedUser.messagesSent || 0;

    await ctx.db.patch(args.authenticatedUserId, {
      messagesSent: authenticatedMessageCount + anonymousMessageCount,
      // For monthly usage, add the anonymous messages to the current month
      monthlyMessagesSent:
        (authenticatedUser.monthlyMessagesSent || 0) + anonymousMessageCount,
    });

    // Delete the anonymous user
    await ctx.db.delete(args.anonymousUserId);

    return { action: "merged" as const };
  },
});
