import { AIModel } from "@/types";
import {
  BrainIcon,
  EyeIcon,
  WrenchIcon,
  LightningIcon,
  CodeIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import {
  CAPABILITY_PATTERNS,
  checkModelPatterns,
  getCapabilityFromPatterns,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_TEXT_TYPES,
} from "convex/lib/model_capabilities_config";

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4": "GPT-4",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
  "gemini-2.5-flash-lite-preview-06-17": "Gemini 2.5 Flash Lite",
  "google/gemini-2.5-flash-preview-05-20": "Gemini 2.5 Flash",
  "google/gemini-2.5-pro-preview-05-06": "Gemini 2.5 Pro",
  "google/gemini-2.5-flash-lite-preview-06-17": "Gemini 2.5 Flash Lite",
  "deepseek/deepseek-v3": "DeepSeek V3",
  "deepseek/deepseek-r1-0528": "DeepSeek R1",
  "x-ai/grok-3-mini": "Grok 3 Mini",
};

export function getModelDisplayName(modelId: string, model?: AIModel): string {
  if (model?.name) {
    return model.name;
  }
  return MODEL_DISPLAY_NAMES[modelId] || "Select model";
}

export function inferProviderFromModelId(modelId: string): string {
  const openRouterModelIds = [
    "google/gemini-2.5-flash-preview-05-20",
    "google/gemini-2.5-pro-preview-05-06",
    "x-ai/grok-3-mini",
    "deepseek/deepseek-v3",
    "deepseek/deepseek-r1-0528",
  ];

  if (openRouterModelIds.includes(modelId)) {
    return "openrouter";
  }

  if (
    modelId.includes("/") ||
    modelId.includes("deepseek") ||
    modelId.includes("grok") ||
    (modelId.includes("gemini") && modelId.includes("preview"))
  ) {
    return "openrouter";
  }

  const providerPatterns: Record<string, string> = {
    gpt: "openai",
    o1: "openai",
    claude: "anthropic",
    sonnet: "anthropic",
    haiku: "anthropic",
    opus: "anthropic",
    gemini: "google",
    palm: "google",
    bison: "google",
  };

  for (const [pattern, provider] of Object.entries(providerPatterns)) {
    if (modelId.toLowerCase().includes(pattern.toLowerCase())) {
      return provider;
    }
  }

  if (modelId.includes("-") || modelId.includes("/")) {
    return "openrouter";
  }

  return "openai";
}

export function hasReasoningCapabilities(
  model?: ModelForCapabilities
): boolean {
  if (!model) return false;

  if (model.supportsReasoning !== undefined) {
    return model.supportsReasoning;
  }

  const patterns =
    CAPABILITY_PATTERNS.supportsReasoning[
      model.provider as keyof typeof CAPABILITY_PATTERNS.supportsReasoning
    ];
  if (!patterns) return false;

  return checkModelPatterns(model.modelId, patterns);
}

export function hasImageUploadCapabilities(
  model?: ModelForCapabilities
): boolean {
  if (!model) return false;

  if (model.supportsImages !== undefined) {
    console.log("🖼️ Image capability check (explicit):", {
      modelId: model.modelId,
      provider: model.provider,
      supportsImages: model.supportsImages,
      model,
    });
    return model.supportsImages;
  }

  const patterns =
    CAPABILITY_PATTERNS.supportsImages[
      model.provider as keyof typeof CAPABILITY_PATTERNS.supportsImages
    ];
  if (!patterns) {
    console.log("🖼️ Image capability check (no patterns):", {
      modelId: model.modelId,
      provider: model.provider,
    });
    return false;
  }

  const result = checkModelPatterns(model.modelId, patterns);
  console.log("🖼️ Image capability check (pattern matching):", {
    modelId: model.modelId,
    provider: model.provider,
    patterns,
    result,
  });
  return result;
}

export function hasToolsCapabilities(model?: ModelForCapabilities): boolean {
  if (!model) return false;

  if (model.supportsTools !== undefined) {
    return model.supportsTools;
  }

  const patterns =
    CAPABILITY_PATTERNS.supportsTools[
      model.provider as keyof typeof CAPABILITY_PATTERNS.supportsTools
    ];
  if (!patterns) return false;

  return checkModelPatterns(model.modelId, patterns);
}

export function hasFileUploadCapabilities(model?: AIModel): boolean {
  if (!model) return false;

  const result = getCapabilityFromPatterns(
    "supportsFiles",
    model.provider,
    model.modelId,
    model.contextLength
  );

  return result;
}

export function isFastModel(model?: ModelForCapabilities): boolean {
  if (!model) return false;

  return getCapabilityFromPatterns(
    "isFast",
    model.provider,
    model.modelId,
    model.contextLength
  );
}

export function isCodingModel(model?: ModelForCapabilities): boolean {
  if (!model) return false;

  return getCapabilityFromPatterns("isCoding", model.provider, model.modelId);
}

export function isLatestModel(model?: ModelForCapabilities): boolean {
  if (!model) return false;

  return getCapabilityFromPatterns("isLatest", model.provider, model.modelId);
}

export function hasCapability(model?: AIModel, capability?: string): boolean {
  if (!model || !capability) return false;

  switch (capability) {
    case "supportsReasoning":
      return hasReasoningCapabilities(model);
    case "supportsImages":
      return hasImageUploadCapabilities(model);
    case "supportsTools":
      return hasToolsCapabilities(model);
    case "supportsFiles":
      return hasFileUploadCapabilities(model);
    case "fast":
      return isFastModel(model);
    case "coding":
      return isCodingModel(model);
    case "latest":
      return isLatestModel(model);
    default:
      return false;
  }
}

export function resolveModelProvider(
  modelId: string,
  getModelById?: (id: string) => AIModel | undefined
): {
  provider: string;
  model?: AIModel;
  source: "enhanced" | "fallback";
} {
  if (getModelById) {
    const model = getModelById(modelId);
    if (model?.provider) {
      return {
        provider: model.provider,
        model,
        source: "enhanced",
      };
    }
  }

  const provider = inferProviderFromModelId(modelId);
  return {
    provider,
    source: "fallback",
  };
}

export interface ModelCapability {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

export const getCapabilityColor = (capabilityLabel: string) => {
  switch (capabilityLabel) {
    case "Advanced Reasoning":
      return "text-accent-purple";
    case "Vision":
      return "text-accent-blue";
    case "Tools":
      return "text-accent-emerald";
    case "Fast":
      return "text-accent-yellow";
    case "Coding":
      return "text-accent-emerald";
    case "Latest":
      return "text-accent-orange";
    default:
      return "text-accent-blue";
  }
};

type ModelForCapabilities = {
  modelId: string;
  name: string;
  provider: string;
  contextLength?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsReasoning?: boolean;
  supportsTools?: boolean;
  supportsImages?: boolean;
  supportsFiles?: boolean;
  inputModalities?: string[];
};

export const getModelCapabilities = (
  model: ModelForCapabilities
): ModelCapability[] => {
  const capabilities: ModelCapability[] = [];

  if (hasReasoningCapabilities(model)) {
    capabilities.push({
      icon: BrainIcon,
      label: "Advanced Reasoning",
      description: "Chain-of-thought and complex reasoning",
    });
  }

  if (hasImageUploadCapabilities(model)) {
    capabilities.push({
      icon: EyeIcon,
      label: "Vision",
      description: "Can analyze images and visual content",
    });
  }

  if (hasToolsCapabilities(model)) {
    capabilities.push({
      icon: WrenchIcon,
      label: "Tools",
      description: "Can call functions and use external tools",
    });
  }

  if (isFastModel(model)) {
    capabilities.push({
      icon: LightningIcon,
      label: "Fast Responses",
      description: "Optimized for speed and quick interactions",
    });
  }

  if (isCodingModel(model)) {
    capabilities.push({
      icon: CodeIcon,
      label: "Code Generation",
      description: "Specialized in generating and explaining code",
    });
  }

  if (isLatestModel(model)) {
    capabilities.push({
      icon: SparkleIcon,
      label: "Creative Writing",
      description: "Strong creative and storytelling abilities",
    });
  }

  return capabilities;
};

export function hasPdfUploadCapabilities(model?: AIModel): boolean {
  if (!model) return false;

  if (model.provider === "openrouter" && model.inputModalities) {
    return model.inputModalities.includes("file");
  }

  return getCapabilityFromPatterns(
    "supportsPdf",
    model.provider,
    model.modelId,
    model.contextLength
  );
}

export function hasTextFileCapabilities(): boolean {
  return true;
}

export function getSupportedImageTypes(model?: AIModel): string[] {
  const hasImageCapability = hasImageUploadCapabilities(model);
  console.log("🎨 Getting supported image types:", {
    modelId: model?.modelId,
    hasImageCapability,
    willReturnTypes: hasImageCapability ? SUPPORTED_IMAGE_TYPES : [],
  });

  if (!hasImageCapability) {
    return [];
  }

  return [...SUPPORTED_IMAGE_TYPES];
}

export function getSupportedTextTypes(): string[] {
  return [...SUPPORTED_TEXT_TYPES];
}

export function isFileTypeSupported(
  fileType: string,
  model?: AIModel
): { supported: boolean; category: "image" | "pdf" | "text" | "unsupported" } {
  console.log("🔍 Checking file type support:", {
    fileType,
    hasModel: !!model,
    modelId: model?.modelId,
    provider: model?.provider,
  });

  const supportedImageTypes = getSupportedImageTypes(model);
  if (supportedImageTypes.includes(fileType)) {
    console.log("✅ File is supported as IMAGE");
    return { supported: true, category: "image" };
  }

  if (fileType === "application/pdf" && hasPdfUploadCapabilities(model)) {
    console.log("✅ File is supported as PDF");
    return { supported: true, category: "pdf" };
  }

  const supportedTextTypes = getSupportedTextTypes();
  if (supportedTextTypes.includes(fileType)) {
    console.log("✅ File is supported as TEXT");
    return { supported: true, category: "text" };
  }

  if (
    fileType.startsWith("text/") ||
    fileType === "application/json" ||
    fileType === "application/xml" ||
    fileType === "application/yaml" ||
    fileType === "" || // Sometimes text files have no MIME type
    fileType === "application/octet-stream" // Generic binary that might be text
  ) {
    console.log("✅ File is supported as TEXT (heuristic)");
    return { supported: true, category: "text" };
  }

  console.log("❌ File type not supported");
  return { supported: false, category: "unsupported" };
}
