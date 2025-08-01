import { type CoreMessage, streamText, generateText } from "ai";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { type Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import {
  type Citation,
  type MessagePart,
  type StorageData,
  type StreamMessage,
} from "../types";
import { buildContextMessages } from "../lib/conversation_utils";
import {
  reasoningConfigForActionSchema,
  modelForInternalActionsSchema,
} from "../lib/schemas";
import { CONFIG } from "./config";
import {
  createLanguageModel,
  getProviderStreamOptions,
} from "./server_streaming";
import { getApiKey } from "./encryption";
import { getUserFriendlyErrorMessage } from "./error_handlers";
import {
  createAdaptiveBatchingState,
  addChunk,
  flushBuffer,
  finalizeBatching,
} from "./server_utils";
import { setStreamActive, clearStream } from "../lib/streaming_utils";
import { log } from "../lib/logger";

// Web search imports
import {
  generateSearchNeedAssessment,
  generateSearchStrategy,
  parseSearchNeedAssessment,
  parseSearchStrategy,
  type SearchDecisionContext,
} from "./search_detection";
import { performWebSearch } from "./exa";

// Unified storage converter
export const convertStorageToData = async (
  ctx: ActionCtx,
  storageId: Id<"_storage">,
  fileType?: string
): Promise<StorageData> => {
  const blob = await ctx.storage.get(storageId);
  if (!blob) {
    throw new Error("File not found in storage");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  const base64 = Buffer.from(uint8Array).toString("base64");

  const mimeType =
    blob.type ||
    CONFIG.MIME_TYPES[fileType as keyof typeof CONFIG.MIME_TYPES] ||
    CONFIG.MIME_TYPES.default;

  return { blob, arrayBuffer, base64, mimeType };
};

// Unified attachment converter
export const convertAttachment = async (
  ctx: ActionCtx,
  attachment: { storageId: Id<"_storage">; type: string; name?: string },
  format: "dataUrl" | "aiSdk"
): Promise<string | { data: ArrayBuffer; mimeType: string }> => {
  const storageData = await convertStorageToData(
    ctx,
    attachment.storageId,
    attachment.type
  );

  if (format === "dataUrl") {
    return `data:${storageData.mimeType};base64,${storageData.base64}`;
  }

  return { data: storageData.arrayBuffer, mimeType: storageData.mimeType };
};

// Convert message part to AI SDK format
export const convertMessagePart = async (
  ctx: ActionCtx,
  part: MessagePart,
  provider: string
) => {
  const converters = {
    text: () => ({ type: "text" as const, text: part.text || "" }),

    image_url: async () => {
      if (part.attachment?.storageId) {
        try {
          const dataUrl = (await convertAttachment(
            ctx,
            part.attachment,
            "dataUrl"
          )) as string;
          return { type: "image" as const, image: dataUrl };
        } catch {
          // Failed to convert Convex attachment, falling back to URL
        }
      }
      return { type: "image" as const, image: part.image_url?.url || "" };
    },

    file: async () => {
      // Check if this is a Convex storage attachment for PDF and provider supports it
      if (
        part.attachment?.storageId &&
        part.attachment.type === "pdf" &&
        (provider === "anthropic" || provider === "google")
      ) {
        try {
          const { data, mimeType } = (await convertAttachment(
            ctx,
            part.attachment,
            "aiSdk"
          )) as { data: ArrayBuffer; mimeType: string };
          return { type: "file" as const, data, mimeType };
        } catch {
          // Failed to convert Convex PDF, falling back to text
        }
      }
      // Fallback to text format
      return {
        type: "text" as const,
        text: `File: ${part.file?.filename || "Unknown"}\n${
          part.file?.file_data || ""
        }`,
      };
    },
  };

  const converter = converters[part.type as keyof typeof converters];
  return converter ? await converter() : { type: "text" as const, text: "" };
};

// Convert our message format to AI SDK format
export const convertMessages = async (
  ctx: ActionCtx,
  messages: StreamMessage[],
  provider: string
): Promise<CoreMessage[]> => {
  const promises = messages.map((msg): Promise<CoreMessage> => {
    if (typeof msg.content === "string") {
      return Promise.resolve({
        role: msg.role,
        content: msg.content,
      } as CoreMessage);
    }

    // Handle multi-modal content
    return Promise.all(
      msg.content.map((part) => convertMessagePart(ctx, part, provider))
    ).then(
      (parts) =>
        ({
          role: msg.role,
          content: parts,
        } as CoreMessage)
    );
  });

  return Promise.all(promises);
};

// Update message helper
export const updateMessage = async (
  ctx: ActionCtx,
  messageId: Id<"messages">,
  updates: {
    content?: string;
    reasoning?: string;
    finishReason?: string;
    citations?: Citation[];
  }
) => {
  try {
    // Get current message to preserve existing metadata
    const currentMessage = await ctx.runQuery(api.messages.getById, {
      id: messageId,
    });

    // If message doesn't exist, silently return
    if (!currentMessage) {
      return;
    }

    // Merge metadata to preserve existing fields like stopped
    const metadata = updates.finishReason
      ? {
          ...(currentMessage.metadata || {}),
          finishReason: updates.finishReason,
        }
      : currentMessage.metadata;

    await ctx.runMutation(internal.messages.internalAtomicUpdate, {
      id: messageId,
      content: updates.content,
      reasoning: updates.reasoning || undefined,
      metadata,
      citations: updates.citations?.length ? updates.citations : undefined,
    });
  } catch (error) {
    // If the update fails because the message was deleted, log and continue
    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("nonexistent document"))
    ) {
      return;
    }
    // Re-throw other errors
    throw error;
  }
};

// Clear conversation streaming state
export const clearConversationStreaming = async (
  ctx: ActionCtx,
  messageId: Id<"messages">
) => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // Use query instead of mutation to get message data
      const message = await ctx.runQuery(api.messages.getById, {
        id: messageId,
      });

      if (message?.conversationId) {
        await ctx.runMutation(internal.conversations.internalPatch, {
          id: message.conversationId,
          updates: { isStreaming: false },
          setUpdatedAt: true,
        });
      }

      // Success - exit retry loop
      return;
    } catch (error) {
      attempts++;

      // If it's a write conflict and we have retries left, wait and try again
      if (
        attempts < maxAttempts &&
        error instanceof Error &&
        error.message.includes("Documents read from or written to")
      ) {
        // Exponential backoff: 50ms, 100ms, 200ms
        const delay = 50 * Math.pow(2, attempts - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Final attempt failed or different error type
      // Don't log write conflicts as warnings since they're expected
      if (
        !(
          error instanceof Error &&
          error.message.includes("Documents read from or written to")
        )
      ) {
        // Failed to clear streaming state
      }
      return; // Give up gracefully
    }
  }
};

export const streamResponse = internalAction({
  args: {
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    model: modelForInternalActionsSchema, // Full model object instead of strings
    personaId: v.optional(v.id("personas")),
    reasoningConfig: v.optional(reasoningConfigForActionSchema),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    frequencyPenalty: v.optional(v.number()),
    presencePenalty: v.optional(v.number()),
    useWebSearch: v.boolean(), // Determined by calling action based on user auth
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(
      "[stream_generation] Starting streaming:",
      args.model.modelId,
      "messageId:",
      args.messageId,
      "conversationId:",
      args.conversationId
    );

    // Use the search availability determined by the calling action
    const isSearchEnabled = args.useWebSearch;

    // Create AbortController for proper stream interruption
    const abortController = new AbortController();

    // Register this stream as active for stop functionality
    setStreamActive(args.conversationId, abortController);

    // Optimized streaming state tracking
    let isStreamingStopped = false;

    // Set up abort signal listener to update the flag
    abortController.signal.addEventListener("abort", () => {
      console.log(
        "[stream_generation] Abort signal received, setting isStreamingStopped flag"
      );
      isStreamingStopped = true;
    });

    // Create a robust abort checker function
    const checkAbort = () => {
      const aborted = abortController.signal.aborted || isStreamingStopped;
      return aborted;
    };

    // Clean up function
    const cleanup = () => {
      clearStream(args.conversationId);
    };

    // Initialize content tracking variables
    let fullContent = "";

    // Enhanced error handling
    const handleStreamError = async (error: any) => {
      log.error("Stream generation error", error);

      // Don't treat abort as error - it's intentional user action
      if (
        error.name === "AbortError" ||
        abortController.signal.aborted ||
        isStreamingStopped
      ) {
        log.info("Stream was interrupted by user");

        // Properly finalize the message as stopped
        try {
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: args.messageId,
            content: fullContent || "",
            reasoning: undefined,
            finishReason: "stop",
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          });

          await ctx.runMutation(internal.messages.updateMessageStatus, {
            messageId: args.messageId,
            status: "done",
          });
        } catch (updateError) {
          log.error(
            "Failed to finalize stopped message:",
            updateError
          );
        }

        return;
      }

      const errorMessage = getUserFriendlyErrorMessage(error);

      try {
        await ctx.runMutation(internal.messages.updateContent, {
          messageId: args.messageId,
          content: errorMessage,
          finishReason: "error",
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        });

        await ctx.runMutation(internal.messages.updateMessageStatus, {
          messageId: args.messageId,
          status: "error",
        });
      } catch (updateError) {
        log.error(
          "Failed to update error state:",
          updateError
        );
      }
    };

    try {
      // Get persona system prompt if available
      let systemPrompt = "You are a helpful AI assistant."; // Default
      if (args.personaId) {
        const persona = await ctx.runQuery(api.personas.get, {
          id: args.personaId,
        });
        if (persona?.prompt) {
          systemPrompt = persona.prompt;
          log.debug(`Using persona: ${persona.name}`);
        }
      }

      // Get conversation context
      const contextResult = await buildContextMessages(ctx, {
        conversationId: args.conversationId,
        personaId: args.personaId,
      });

      const { contextMessages } = contextResult;
      log.debug(
      `Built context with ${contextMessages.length} messages`
      );

      log.debug("Search enabled:", isSearchEnabled, "determined by calling action");

      // Override the system message with the persona prompt
      if (contextMessages.length > 0 && contextMessages[0].role === "system") {
        contextMessages[0].content = systemPrompt;
      } else {
        // Prepend system message if not present
        contextMessages.unshift({
          role: "system",
          content: systemPrompt,
        });
      }

      // Use the model object properties
      const effectiveProvider = args.model.provider;
      const effectiveModel = args.model.modelId;

      log.debug(
        `Using model: ${effectiveModel}/${effectiveProvider}`
      );

      // Get API key for the effective provider
      const apiKey = await getApiKey(
        ctx,
        effectiveProvider as any,
        effectiveModel,
        args.conversationId
      );

      // Create language model with user's selected model
      const model = await createLanguageModel(
        ctx,
        effectiveProvider as any,
        effectiveModel,
        apiKey
      );

      // Perform web search if enabled and needed
      if (isSearchEnabled) {
        log.debug("Starting search detection process");
        
        const userMessages = contextMessages.filter(msg => msg.role === "user");
        const latestUserMessage = userMessages[userMessages.length - 1];
        
        if (latestUserMessage && typeof latestUserMessage.content === "string") {
          try {
            // Step 1: Check if search is needed using LLM
            const searchContext: SearchDecisionContext = {
              userQuery: latestUserMessage.content,
              conversationHistory: contextMessages.slice(-5).filter(msg => msg.role !== "system").map(msg => ({
                role: msg.role as "user" | "assistant",
                content: typeof msg.content === "string" ? msg.content : "[multimodal content]",
                hasSearchResults: false, // TODO: Track this properly
              })),
            };

            const needAssessmentPrompt = generateSearchNeedAssessment(searchContext);
            
            // Use built-in Gemini for search detection to ensure we have API keys
            const searchDetectionApiKey = await getApiKey(ctx, "google", "gemini-2.0-flash-exp", args.conversationId);
            const searchDetectionModel = await createLanguageModel(
              ctx,
              "google",
              "gemini-2.0-flash-exp", 
              searchDetectionApiKey
            );
            
            log.debug("Calling LLM for search need assessment using built-in Gemini");
            const { text: needAssessmentResponse } = await generateText({
              model: searchDetectionModel,
              prompt: needAssessmentPrompt,
              temperature: 0.1, // Low temperature for consistent decision making
            });

            const searchNeed = parseSearchNeedAssessment(needAssessmentResponse);
            log.debug("Search needed:", !searchNeed.canAnswerConfidently);

            // Step 2: If search is needed, determine search strategy
            if (!searchNeed.canAnswerConfidently) {
              const searchStrategyPrompt = generateSearchStrategy(searchContext);
              
              log.debug("Calling LLM for search strategy using built-in Gemini");
              const { text: strategyResponse } = await generateText({
                model: searchDetectionModel,
                prompt: searchStrategyPrompt,
                temperature: 0.1,
              });

              const searchDecision = parseSearchStrategy(strategyResponse, latestUserMessage.content);
                              log.debug("Search strategy:", searchDecision.searchType, "for query:", searchDecision.suggestedQuery);

              // Step 3: Get EXA API key - TODO: Add EXA as a proper provider type
              const exaApiKey = process.env.EXA_API_KEY;
                              if (!exaApiKey) {
                  log.debug("No EXA API key configured, skipping web search");
                  log.debug("To enable web search, add EXA_API_KEY environment variable");
              } else {
                // NOW set status to searching since we're actually about to perform web search
                await ctx.runMutation(internal.messages.updateMessageStatus, {
                  messageId: args.messageId,
                  status: "searching",
                });

                // Set search metadata with actual strategy now that we're searching
                await ctx.runMutation(internal.messages.updateAssistantContent, {
                  messageId: args.messageId,
                  metadata: {
                    searchQuery: searchDecision.suggestedQuery || latestUserMessage.content,
                    searchFeature: searchDecision.searchType, // "answer", "similar", "search"
                    searchCategory: searchDecision.category, // "company", "news", etc.
                  },
                });

                                  log.debug("Performing EXA search");
                const searchResult = await performWebSearch(exaApiKey, {
                  query: searchDecision.suggestedQuery || latestUserMessage.content,
                  searchType: searchDecision.searchType,
                  category: searchDecision.category,
                  maxResults: 12, // TODO: Make this configurable
                });

                // Step 4: Add search results to context
                if (searchResult.citations.length > 0) {
                                      log.debug("Adding", searchResult.citations.length, "search results to context");
                  
                  // Create a system message with search results
                  const searchResultsMessage = {
                    role: "system" as const,
                    content: `🚨 CRITICAL CITATION REQUIREMENTS 🚨

Based on the user's query, I have searched the web and found relevant information. You MUST cite sources for any information derived from these search results.

SEARCH RESULTS:
${searchResult.context}

AVAILABLE SOURCES FOR CITATION:
${searchResult.citations.map((citation, idx) => 
  `[${idx + 1}] ${citation.title} - ${citation.url}`
).join('\n')}

When using information from these search results, you MUST include citations in the format [1], [2], etc. corresponding to the source numbers above.`,
                  };

                  // Insert search results after system message but before conversation
                  contextMessages.splice(1, 0, searchResultsMessage);
                  
                  // Update message with citations for UI display
                  await ctx.runMutation(internal.messages.updateAssistantContent, {
                    messageId: args.messageId,
                    citations: searchResult.citations,
                  });
                  
                                      log.debug("Search results added to context successfully");
                } else {
                  log.debug("No search results found");
                  
                  // Update with empty citations array to show search was attempted
                  await ctx.runMutation(internal.messages.updateAssistantContent, {
                    messageId: args.messageId,
                    citations: [], // Empty array indicates search was done but found nothing
                  });
                }
              }
            } else {
              log.debug("LLM determined search is not needed");
            }
                      } catch (error) {
              log.error("Error during search process:", error);
            
            // Clear search metadata since search failed
            await ctx.runMutation(internal.messages.updateAssistantContent, {
              messageId: args.messageId,
              metadata: {
                searchQuery: undefined,
                searchFeature: undefined,
                searchCategory: undefined,
              },
            });
            
            // Continue without search - don't break the conversation flow
          } finally {
            // Reset status to thinking after search is complete (success or failure)
            // Keep search metadata for citations display, but SearchQuery won't show due to status change
            await ctx.runMutation(internal.messages.updateMessageStatus, {
              messageId: args.messageId,
              status: "thinking",
            });
          }
        } else {
          log.debug("No suitable user message found for search");
        }
      }

      // Convert messages to AI SDK format
      const convertedMessages = await convertMessages(
        ctx,
        contextMessages,
        effectiveProvider as any
      );

      // Get reasoning-specific stream options (simplified logging)
      // Only pass reasoning config if enabled
      const enabledReasoningConfig = args.reasoningConfig?.enabled
        ? {
            effort: args.reasoningConfig.effort,
            maxTokens: args.reasoningConfig.maxTokens,
          }
        : undefined;

      const streamOptions = await getProviderStreamOptions(
        ctx,
        effectiveProvider as any,
        effectiveModel,
        enabledReasoningConfig,
        args.model // Pass the full model object instead of undefined
      );

      // Prepare generation options with proper abortSignal
      const generationOptions: any = {
        model,
        messages: convertedMessages,
        abortSignal: abortController.signal,
        ...streamOptions, // Merge reasoning options
      };

      // Only include optional parameters if they are valid
      if (args.temperature !== undefined)
        generationOptions.temperature = args.temperature;
      if (args.maxTokens && args.maxTokens > 0)
        generationOptions.maxTokens = args.maxTokens;
      if (args.topP !== undefined) generationOptions.topP = args.topP;
      if (args.frequencyPenalty !== undefined)
        generationOptions.frequencyPenalty = args.frequencyPenalty;
      if (args.presencePenalty !== undefined)
        generationOptions.presencePenalty = args.presencePenalty;

      // Set initial status to thinking
      await ctx.runMutation(internal.messages.updateMessageStatus, {
        messageId: args.messageId,
        status: "thinking",
      });

      log.streamStart(args.model.modelId, args.model.provider, args.messageId);

      // OPTIMIZED STREAMING: Adaptive batching for better performance
      let contentBatcher = createAdaptiveBatchingState(
        args.messageId + ":content",
        10, // Initial batch size
        100 // Initial update interval (ms)
      );

      // Create reasoning batcher for real-time reasoning streaming
      let reasoningBatcher = createAdaptiveBatchingState(
        args.messageId + ":reasoning",
        5, // Smaller batch size for reasoning
        50 // Faster updates for reasoning
      );

      // Generate streaming response using AI SDK with onChunk for incremental reasoning
      const result = streamText({
        ...generationOptions,
        onChunk: async ({ chunk }) => {
          // Check for abort signal before processing any chunk
          if (checkAbort()) {
            log.streamAbort(`Stream ${args.messageId.slice(-8)} stopped`);
            throw new Error("Stream aborted");
          }

          // Only log reasoning chunks, not every text chunk to reduce noise
          if (chunk.type === "reasoning" && chunk.textDelta) {
            log.streamReasoning(args.messageId, chunk.textDelta);

            // Double-check abort before processing reasoning
            if (checkAbort()) {
              log.streamAbort("Reasoning processing stopped");
              throw new Error("Stream aborted during reasoning");
            }

            const reasoningBatchResult = addChunk(
              reasoningBatcher,
              chunk.textDelta
            );
            reasoningBatcher = reasoningBatchResult.state;
            if (
              reasoningBatchResult.shouldFlush &&
              reasoningBatchResult.content
            ) {
              // Triple-check abort before sending to frontend
              if (checkAbort()) {
                log.streamAbort("Reasoning update blocked");
                throw new Error("Stream aborted before reasoning update");
              }

              try {
                await ctx.runMutation(
                  internal.messages.updateAssistantContent,
                  {
                    messageId: args.messageId,
                    appendReasoning: reasoningBatchResult.content,
                    status: "streaming",
                  }
                );
              } catch (updateError) {
                log.streamError("Reasoning update failed", updateError);
              }
            }
          }
        },
      });

      // Set status to streaming when we start receiving chunks
      await ctx.runMutation(internal.messages.updateMessageStatus, {
        messageId: args.messageId,
        status: "streaming",
      });



      // Process text content stream (this also ensures completion)
      let chunkCount = 0;
      for await (const chunk of result.textStream) {
        chunkCount++;
        if (checkAbort()) {
          log.streamAbort(`Text processing stopped at chunk ${chunkCount}`);
          break;
        }

        fullContent += chunk;

        const batchResult = addChunk(contentBatcher, chunk);
        contentBatcher = batchResult.state;
        if (batchResult.shouldFlush && batchResult.content) {
          try {
            await ctx.runMutation(internal.messages.updateAssistantContent, {
              messageId: args.messageId,
              appendContent: batchResult.content,
              status: "streaming",
            });
          } catch (updateError) {
            log.streamError("Content update failed", updateError);
          }
        }
      }

      log.streamComplete(args.messageId, chunkCount, fullContent.length);

      // Check if we got no content - this might indicate safety filter blocking
      if (chunkCount === 0 && fullContent.length === 0) {
        log.streamError(
          `No content from ${args.model.provider}/${args.model.modelId} - possibly blocked by safety filters`
        );

        // Set an appropriate error message for the user
        const errorMessage = "The AI provider returned no content. Please try again or rephrase your request.";

        await ctx.runMutation(internal.messages.updateContent, {
          messageId: args.messageId,
          content: errorMessage,
          finishReason: "error",
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        });

        await ctx.runMutation(internal.messages.updateMessageStatus, {
          messageId: args.messageId,
          status: "error",
        });

        return;
      }

      // Reasoning is now handled incrementally via onChunk callback above

      // Final flush of any remaining content
      const finalFlushResult = flushBuffer(contentBatcher);
      const finalContent = finalFlushResult.content;

      if (finalContent.length > 0 && !isStreamingStopped) {
        try {
          await ctx.runMutation(internal.messages.updateAssistantContent, {
            messageId: args.messageId,
            appendContent: finalContent,
            status: "streaming",
          });
        } catch (updateError) {
          log.streamError("Final content update failed", updateError);
        }
      }

      // Finalize performance monitoring
      finalizeBatching(contentBatcher);
      finalizeBatching(reasoningBatcher);

      // Only finalize if not stopped
      if (!isStreamingStopped && !abortController.signal.aborted) {
        log.info(`Stream finalized: ${args.messageId.slice(-8)} completed`);

        // Finalize the message with complete content and metadata
        await ctx.runMutation(internal.messages.updateContent, {
          messageId: args.messageId,
          content: fullContent,
          finishReason: "stop",
          usage: {
            promptTokens: 0, // We don't have usage info from streaming
            completionTokens: 0,
            totalTokens: 0,
          },
        });

        // Set final status to done
        await ctx.runMutation(internal.messages.updateMessageStatus, {
          messageId: args.messageId,
          status: "done",
        });
      }
    } catch (error: any) {
      await handleStreamError(error);
    } finally {
      // Always clean up
      cleanup();

      // Always ensure conversation is no longer streaming
      try {
        await ctx.runMutation(internal.conversations.internalPatch, {
          id: args.conversationId,
          updates: { isStreaming: false },
        });
      } catch (cleanupError) {
        console.warn(
          "[stream_generation] Failed to clear streaming state:",
          cleanupError
        );
      }
    }

    return null;
  },
});
