import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUserId, getOptionalUserId } from "./lib/auth";

export const getUserSettings = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = args.userId || (await getOptionalUserId(ctx));
    if (!userId) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();

    // Return defaults if no settings exist
    if (!settings) {
      return {
        personasEnabled: true, // Default to enabled
        openRouterSorting: "default" as const, // Default to OpenRouter's load balancing
        anonymizeForDemo: false, // Default to disabled
      };
    }

    return {
      personasEnabled: settings.personasEnabled ?? true, // Default to enabled if null/undefined
      openRouterSorting: settings.openRouterSorting ?? ("default" as const), // Default to load balancing
      anonymizeForDemo: settings.anonymizeForDemo ?? false, // Default to disabled
    };
  },
});

export const updateUserSettings = mutation({
  args: {
    personasEnabled: v.optional(v.boolean()),
    openRouterSorting: v.optional(
      v.union(
        v.literal("default"),
        v.literal("price"),
        v.literal("throughput"),
        v.literal("latency")
      )
    ),
    anonymizeForDemo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        ...(args.personasEnabled !== undefined && {
          personasEnabled: args.personasEnabled,
        }),
        ...(args.openRouterSorting !== undefined && {
          openRouterSorting: args.openRouterSorting,
        }),
        ...(args.anonymizeForDemo !== undefined && {
          anonymizeForDemo: args.anonymizeForDemo,
        }),
        updatedAt: now,
      });
    } else {
      // Create new settings
      await ctx.db.insert("userSettings", {
        userId,
        personasEnabled: args.personasEnabled ?? true,
        openRouterSorting: args.openRouterSorting ?? "default",
        anonymizeForDemo: args.anonymizeForDemo ?? false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const togglePersonasEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();

    const now = Date.now();

    await (existingSettings
      ? ctx.db.patch(existingSettings._id, {
          personasEnabled: args.enabled,
          updatedAt: now,
        })
      : ctx.db.insert("userSettings", {
          userId,
          personasEnabled: args.enabled,
          createdAt: now,
          updatedAt: now,
        }));

    return { success: true };
  },
});
