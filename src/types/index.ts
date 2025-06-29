import { type Doc, type Id } from "../../convex/_generated/dataModel";

export type User = Doc<"users">;

export type Conversation = Doc<"conversations">;

export type Message = Doc<"messages">;

export type ConversationId = Id<"conversations">;

export type MessageId = Id<"messages">;

export type UserId = Id<"users">;

export type AIProvider = {
  id: string;
  name: string;
  models: AIModel[];
  requiresApiKey: boolean;
  supportsImages: boolean;
  supportsStreaming: boolean;
};

export type AIModel = Doc<"userModels">;

export type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  top_provider: {
    context_length: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture: {
    modality?: string;
    tokenizer: string;
    instruct_type?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
  pricing?: {
    internal_reasoning?: string;
  };
  created?: number;
  hugging_face_id?: string;
  per_request_limits?: Record<string, unknown>;
};

// Provider-specific model interfaces for handling different API responses

export type GeminiApiModel = {
  name: string; // E.g., "models/gemini-1.5-pro"
  baseModelId: string; // E.g., "gemini-1.5-pro"
  version: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
  temperature?: number;
  maxTemperature?: number;
  topP?: number;
  topK?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "context";
  content: string;
  reasoning?: string; // Internal reasoning/thinking tokens
  model?: string;
  provider?: string;
  parentId?: string;
  isMainBranch: boolean;
  sourceConversationId?: string;
  useWebSearch?: boolean;
  attachments?: Attachment[];
  citations?: WebSearchCitation[]; // Web search citations
  webSearchResults?: WebSearchResult[]; // Full web search metadata
  metadata?: {
    tokenCount?: number;
    reasoningTokenCount?: number;
    finishReason?: string;
    duration?: number;
    stopped?: boolean;
  };
  createdAt: number;
};

export type Attachment = {
  type: "image" | "pdf" | "text";
  url: string;
  name: string;
  size: number;
  content?: string; // For text files, we'll store the actual text content
  thumbnail?: string; // For images, we'll store a small thumbnail for preview
  storageId?: Id<"_storage">; // Convex storage ID for files uploaded to Convex storage
};

// Web Search Types

export type WebSearchCitation = {
  type: "url_citation";
  url: string;
  title: string;
  cited_text?: string;
  snippet?: string;
  description?: string; // OpenGraph description or meta description
  image?: string; // OpenGraph image or thumbnail URL
  favicon?: string; // Website favicon URL
  siteName?: string; // Website name (e.g., "GitHub", "Stack Overflow")
  publishedDate?: string; // Article publish date if available
  author?: string; // Author information if available
};

export type WebSearchResult = {
  query: string;
  results: WebSearchCitation[];
  timestamp: number;
  provider: string;
};

export type APIKeys = {
  openai?: string;
  anthropic?: string;
  google?: string;
  openrouter?: string;
};

export type MessageRole = "user" | "assistant" | "system" | "context";
