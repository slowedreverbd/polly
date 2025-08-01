import { getAuthUserId } from "@convex-dev/auth/server";
import { DEFAULT_BUILTIN_MODEL_ID } from "@shared/constants";
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      // Return only built-in personas for anonymous users
      return await ctx.db
        .query("personas")
        .withIndex("by_built_in", q => q.eq("isBuiltIn", true))
        .filter(q => q.eq(q.field("isActive"), true))
        .order("asc")
        .take(50); // Reasonable limit for personas
    }

    // Get both built-in and user personas
    const builtInPersonas = await ctx.db
      .query("personas")
      .withIndex("by_built_in", q => q.eq("isBuiltIn", true))
      .filter(q => q.eq(q.field("isActive"), true))
      .take(50); // Reasonable limit for built-in personas

    const userPersonas = await ctx.db
      .query("personas")
      .withIndex("by_user_active", q =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .take(100); // Reasonable limit for user personas

    // Get user's persona settings to filter out disabled built-in personas
    const userPersonaSettings = await ctx.db
      .query("userPersonaSettings")
      .withIndex("by_user_persona", q => q.eq("userId", userId))
      .take(100); // Reasonable limit for user persona settings

    const disabledPersonaIds = new Set(
      userPersonaSettings
        .filter(setting => setting.isDisabled)
        .map(setting => setting.personaId)
    );

    // Filter out disabled built-in personas
    const enabledBuiltInPersonas = builtInPersonas.filter(
      persona => !disabledPersonaIds.has(persona._id)
    );

    return [...enabledBuiltInPersonas, ...userPersonas].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );
  },
});

export const get = query({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    prompt: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const now = Date.now();

    return await ctx.db.insert("personas", {
      userId,
      name: args.name,
      description: args.description,
      prompt: args.prompt,
      icon: args.icon,
      isBuiltIn: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("personas"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    prompt: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const persona = await ctx.db.get(args.id);
    if (!persona) {
      throw new Error("Persona not found");
    }

    // Only allow updating user's own personas
    if (persona.userId && persona.userId !== userId) {
      throw new Error("Not authorized to update this persona");
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.prompt !== undefined && { prompt: args.prompt }),
      ...(args.icon !== undefined && { icon: args.icon }),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const persona = await ctx.db.get(args.id);
    if (!persona) {
      throw new Error("Persona not found");
    }

    // Only allow removing user's own personas
    if (persona.userId && persona.userId !== userId) {
      throw new Error("Not authorized to remove this persona");
    }

    await ctx.db.delete(args.id);
  },
});

export const togglePersona = mutation({
  args: {
    id: v.id("personas"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const persona = await ctx.db.get(args.id);
    if (!persona) {
      throw new Error("Persona not found");
    }

    // Only allow toggling user's own personas
    if (persona.userId && persona.userId !== userId) {
      throw new Error("Not authorized to toggle this persona");
    }

    await ctx.db.patch(args.id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
  },
});

export const listForExport = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("personas")
      .withIndex("by_user_active", q =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .take(100); // Reasonable limit for export
  },
});

import { personaImportSchema } from "./lib/schemas";

export const importPersonas = mutation({
  args: {
    personas: v.array(personaImportSchema),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const now = Date.now();
    const createdPersonas = [];

    for (const persona of args.personas) {
      const personaId = await ctx.db.insert("personas", {
        userId,
        name: persona.name,
        description: persona.description,
        prompt: persona.prompt,
        icon: persona.icon,
        isBuiltIn: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      createdPersonas.push(personaId);
    }

    return createdPersonas;
  },
});

export const listAllBuiltIn = query({
  handler: async ctx => {
    return await ctx.db
      .query("personas")
      .withIndex("by_built_in", q => q.eq("isBuiltIn", true))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getUserPersonaSettings = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("userPersonaSettings")
      .withIndex("by_user_persona", q => q.eq("userId", userId))
      .collect();
  },
});

export const toggleBuiltInPersona = mutation({
  args: {
    personaId: v.id("personas"),
    isDisabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    // Verify this is a built-in persona
    const persona = await ctx.db.get(args.personaId);
    if (!persona?.isBuiltIn) {
      throw new Error("Can only toggle built-in personas");
    }

    // Check if setting already exists
    const existingSetting = await ctx.db
      .query("userPersonaSettings")
      .withIndex("by_user_persona", q =>
        q.eq("userId", userId).eq("personaId", args.personaId)
      )
      .first();

    const now = Date.now();

    if (existingSetting) {
      // Update existing setting
      await ctx.db.patch(existingSetting._id, {
        isDisabled: args.isDisabled,
        updatedAt: now,
      });
    } else {
      // Create new setting
      await ctx.db.insert("userPersonaSettings", {
        userId,
        personaId: args.personaId,
        isDisabled: args.isDisabled,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const improvePrompt = action({
  args: {
    prompt: v.string(),
  },
  handler: async (_, args): Promise<{ improvedPrompt: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const promptText = `You are a system prompt improvement assistant. Take the user's initial prompt and transform it into a more detailed, structured system prompt for an AI assistant.

Follow these guidelines:
1. Maintain the core intent and personality of the original prompt
2. Structure the improved prompt with clear sections using markdown headers
3. Include specific behavioral guidelines:
   - Communication style and tone instructions
   - Response formatting preferences
   - How to handle limitations or things you can't do
   - Safety and ethics considerations if relevant
4. Avoid unnecessary affirmations like "Certainly!", "Of course!", etc.
5. Emphasize being direct and genuinely helpful
6. Add instructions for:
   - When to be concise vs. thorough
   - How to match the user's tone
   - How to handle uncertainty
7. Keep it focused and practical (aim for 300-500 words)
8. Use second person ("You are...", "You should...")
9. End with a brief reminder of the assistant's core purpose

Return ONLY the improved prompt text, no explanations or metadata.

User's initial prompt:
${args.prompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_BUILTIN_MODEL_ID}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      await response.json(); // Consume the error response
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const improvedPrompt =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!improvedPrompt) {
      throw new Error("No improvement generated");
    }

    return { improvedPrompt };
  },
});
