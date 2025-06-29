import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type LanguageModel } from "ai";

import { type ProviderType, type ProviderStreamOptions } from "./types";
import { applyOpenRouterSorting } from "./utils";
import { api } from "../_generated/api";
import { type Id } from "../_generated/dataModel";
import { type ActionCtx } from "../_generated/server";
import { getCapabilityFromPatterns } from "../lib/model_capabilities_config";
import { isReasoningModelEnhanced } from "./reasoning_detection";

// Provider factory map
const createProviderModel = {
  openai: (apiKey: string, model: string) => createOpenAI({ apiKey })(model),
  anthropic: (apiKey: string, model: string) =>
    createAnthropic({ apiKey })(model),
  google: (apiKey: string, model: string, enableWebSearch?: boolean) =>
    createGoogleGenerativeAI({ apiKey })(model, {
      ...(enableWebSearch && { useSearchGrounding: true }),
    }),

  openrouter: async (
    apiKey: string,
    model: string,
    ctx: ActionCtx,
    userId?: Id<"users">,
    enableWebSearch?: boolean
  ) => {
    const openrouter = createOpenRouter({ apiKey });

    // Get user's OpenRouter sorting preference
    let sorting: "default" | "price" | "throughput" | "latency" = "default";
    if (userId) {
      try {
        const userSettings = await ctx.runQuery(
          api.userSettings.getUserSettings,
          { userId }
        );
        sorting = userSettings?.openRouterSorting ?? "default";
      } catch (error) {
        console.warn(
          "Failed to get user settings for OpenRouter sorting:",
          error
        );
      }
    }

    // Apply OpenRouter sorting shortcuts and web search
    let modifiedModel = applyOpenRouterSorting(model, sorting);
    if (enableWebSearch) {
      modifiedModel = `${modifiedModel}:online`;
    }

    return openrouter.chat(modifiedModel);
  },
};

// Create language model based on provider
export const createLanguageModel = async (
  ctx: ActionCtx,
  provider: ProviderType,
  model: string,
  apiKey: string,
  userId?: Id<"users">,
  enableWebSearch?: boolean
): Promise<LanguageModel> => {
  if (provider === "openrouter") {
    return createProviderModel.openrouter(
      apiKey,
      model,
      ctx,
      userId,
      enableWebSearch
    );
  }

  if (provider === "google") {
    return createProviderModel.google(apiKey, model, enableWebSearch);
  }

  const factory = createProviderModel[provider];
  if (!factory) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return factory(apiKey, model);
};

export const getProviderStreamOptions = async (
  provider: ProviderType,
  model: string,
  enableWebSearch?: boolean,
  reasoningConfig?: { effort?: "low" | "medium" | "high"; maxTokens?: number }
): Promise<ProviderStreamOptions> => {
  // Check reasoning support with enhanced detection
  const supportsReasoning = await isReasoningModelEnhanced(provider, model);

  if (!supportsReasoning) {
    return {};
  }

  // OpenAI reasoning configuration
  if (provider === "openai") {
    return {
      openai: {
        reasoning: true,
      },
    };
  }

  // Google thinking configuration for reasoning models
  if (provider === "google") {
    return {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    };
  }

  // Anthropic extended thinking configuration
  if (provider === "anthropic") {
    // Map effort levels to token budgets
    const budgetMap = {
      low: 5000,
      medium: 10000,
      high: 20000,
    };

    const budgetTokens =
      reasoningConfig?.maxTokens ??
      budgetMap[reasoningConfig?.effort ?? "medium"];

    const config = {
      anthropic: {
        thinking: {
          type: "enabled" as const,
          budgetTokens: budgetTokens,
        },
      },
    };

    return config;
  }

  // OpenRouter reasoning configuration
  if (provider === "openrouter") {
    const effort = reasoningConfig?.effort ?? "medium";

    return {
      extraBody: {
        reasoning: {
          effort,
          ...(reasoningConfig?.maxTokens && {
            max_tokens: reasoningConfig.maxTokens,
          }),
        },
      },
    };
  }

  // Other providers don't need special options yet
  return {};
};

export const isReasoningModel = (provider: string, model: string): boolean => {
  return getCapabilityFromPatterns("supportsReasoning", provider, model);
};
