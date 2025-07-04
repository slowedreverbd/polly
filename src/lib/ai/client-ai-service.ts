import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type LanguageModel } from "ai";

import {
  ClientStreamHandler,
  convertToCoreMessages,
} from "./client-stream-handler";
import { getUserFriendlyErrorMessage } from "./errors";
import {
  type AIProviderType,
  type StreamOptions,
  type ChatStreamRequest,
} from "@/types";
import {
  getProviderReasoningConfig,
  supportsReasoning,
} from "./provider-reasoning-config";
import { type ProviderStreamOptions } from "../../../convex/types";
import { AnthropicClient } from "./anthropic-client";

export type { AIProviderType };

function createLanguageModel(
  provider: AIProviderType,
  model: string,
  apiKey: string
): LanguageModel {
  const optimizedFetch = (url: RequestInfo | URL, options?: RequestInit) => {
    return fetch(url, {
      ...options,
      priority: "high" as RequestPriority,
      headers: {
        ...options?.headers,
        "Accept-Encoding": "gzip, deflate, br",
      },
    });
  };

  switch (provider) {
    case "openai":
      return createOpenAI({
        apiKey,
        fetch: optimizedFetch,
      })(model);

    case "anthropic":
      return createAnthropic({
        apiKey,
        fetch: optimizedFetch,
      })(model);

    case "google":
      return createGoogleGenerativeAI({
        apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        fetch: optimizedFetch,
      })(model);

    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey,
        fetch: optimizedFetch,
      });
      return openrouter.chat(model);
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function getProviderStreamOptions(
  provider: AIProviderType,
  model: string,
  options?: StreamOptions
): ProviderStreamOptions {
  const { reasoningConfig } = options || {};
  return getProviderReasoningConfig(provider, model, reasoningConfig);
}

export class ClientAIService {
  private currentStreamHandler: ClientStreamHandler | null = null;
  private currentAbortController: AbortController | null = null;
  private static warmedUpProviders = new Set<AIProviderType>();

  static preWarmProvider(
    provider: AIProviderType,
    apiKey: string
  ): Promise<void> {
    return this.warmUpProvider(provider, apiKey);
  }

  private static async warmUpProvider(
    provider: AIProviderType,
    apiKey: string
  ) {
    if (this.warmedUpProviders.has(provider)) return;

    try {
      const warmUpEndpoints: Record<AIProviderType, string> = {
        google: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        openai: "https://api.openai.com/v1/models",
        anthropic: "https://api.anthropic.com/v1/models",
        openrouter: "https://openrouter.ai/api/v1/models",
      };

      const endpoint = warmUpEndpoints[provider];
      if (!endpoint) return;

      const headers: HeadersInit = {
        "Accept-Encoding": "gzip, deflate, br",
      };

      if (provider === "openai") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === "anthropic") {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else if (provider === "openrouter") {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "Polly Chat";
      }

      const response = await fetch(endpoint, {
        method: "GET",
        headers,
        keepalive: true,
        priority: "high" as RequestPriority,
      });

      if (response.ok || response.status === 401) {
        this.warmedUpProviders.add(provider);
      }
    } catch (_error) {
      // Silently ignore warm-up errors
    }
  }

  async streamChat(request: ChatStreamRequest): Promise<void> {
    const { messages, model, provider, apiKeys, options, callbacks } = request;

    const apiKey = apiKeys[provider];
    if (!apiKey) {
      throw new Error(`No API key configured for provider: ${provider}`);
    }

    if (provider === "anthropic" && supportsReasoning(provider, model)) {
      const anthropicClient = new AnthropicClient(apiKey);
      const abortController = new AbortController();
      this.currentAbortController = abortController;

      try {
        await anthropicClient.streamChat({
          messages,
          model,
          apiKey,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          topP: options?.topP,
          reasoningConfig: options?.reasoningConfig,
          abortSignal: abortController.signal,
          callbacks,
        });
        return;
      } catch (error) {
        const friendlyError = new Error(getUserFriendlyErrorMessage(error));
        callbacks.onError(friendlyError);
        throw friendlyError;
      } finally {
        this.currentAbortController = null;
      }
    }

    if (!ClientAIService.warmedUpProviders.has(provider)) {
      await ClientAIService.warmUpProvider(provider, apiKey);
    }

    const streamHandler = new ClientStreamHandler(callbacks);
    const abortController = new AbortController();
    streamHandler.setAbortController(abortController);
    this.currentAbortController = abortController;

    this.currentStreamHandler = streamHandler;

    try {
      const coreMessages = convertToCoreMessages(messages);

      const languageModel = createLanguageModel(provider, model, apiKey);

      const providerOptions = getProviderStreamOptions(
        provider,
        model,
        options
      );

      const modelSupportsReasoning = supportsReasoning(provider, model);

      const result = streamText({
        model: languageModel,
        messages: coreMessages,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens || 8192,
        topP: options?.topP,
        frequencyPenalty: options?.frequencyPenalty,
        presencePenalty: options?.presencePenalty,
        abortSignal: abortController.signal,
        providerOptions,
        onFinish: ({ text, finishReason, reasoning, providerMetadata }) => {
          streamHandler.handleFinish(
            text,
            finishReason,
            reasoning,
            providerMetadata
          );
        },
      });

      const streamPromise = modelSupportsReasoning
        ? streamHandler.processFullStream(result.fullStream).catch(error => {
            if (error instanceof Error && !error.name.includes("Abort")) {
              return streamHandler.processTextStream(result.textStream);
            } else {
              throw error;
            }
          })
        : streamHandler.processTextStream(result.textStream);

      await streamPromise;
    } catch (error) {
      const friendlyError = new Error(getUserFriendlyErrorMessage(error));
      callbacks.onError(friendlyError);
      throw friendlyError;
    } finally {
      this.currentStreamHandler = null;
      this.currentAbortController = null;
    }
  }

  stopStreaming(): void {
    if (this.currentStreamHandler) {
      this.currentStreamHandler.stop();
      this.currentStreamHandler = null;
    }
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }
}
