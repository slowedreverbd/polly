import { type Id } from "../_generated/dataModel";

/**
 * Safely converts a string to a conversation ID and retrieves the conversation.
 * Returns null if the ID is invalid or conversation doesn't exist.
 * This is the DRY solution for handling potentially invalid conversation IDs from the frontend.
 * @param ctx
 * @param ctx.db
 * @param ctx.db.get
 * @param conversationIdString
 */
export async function getSafeConversation(
  ctx: {
    db: {
      get: (
        id: Id<"conversations">
      ) => Promise<{ _id: Id<"conversations"> } | null>;
    };
  },
  conversationIdString: string
) {
  try {
    const conversationId = conversationIdString as Id<"conversations">;
    return await ctx.db.get(conversationId);
  } catch {
    return null;
  }
}

/**
 * Validator replacement for frontend-facing queries.
 * Use this pattern in queries that accept conversation IDs from the frontend:
 *
 * args: { conversationId: v.string() }
 * handler: async (ctx, args) => {
 *   const conversation = await getSafeConversation(ctx, args.conversationId);
 *   if (!conversation) return null;
 *   // ... rest of handler
 * }
 */
