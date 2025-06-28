import Exa from "exa-js";
import { v } from "convex/values";

import { api } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { type Citation, type WebSource } from "./types";

export const exaSearchArgs = v.object({
  query: v.string(),
  maxResults: v.optional(v.number()),
  searchType: v.optional(v.union(v.literal("keyword"), v.literal("neural"))),
  category: v.optional(
    v.union(
      v.literal("company"),
      v.literal("research paper"),
      v.literal("news"),
      v.literal("github"),
      v.literal("tweet"),
      v.literal("movie"),
      v.literal("song"),
      v.literal("personal site"),
      v.literal("pdf")
    )
  ),
  includeText: v.optional(v.boolean()),
  includeHighlights: v.optional(v.boolean()),
});

export type ExaSearchArgs = typeof exaSearchArgs._type;

// Initialize Exa client with API key
export const createExaClient = (apiKey: string) => {
  return new Exa(apiKey);
};

// Convert Exa search results to our Citation format
export const exaResultsToCitations = (
  results: any[]
): Citation[] => {
  return results.map(result => ({
    type: "url_citation" as const,
    url: result.url,
    title: result.title || "Web Source",
    snippet: result.text || result.snippet || "",
    // Exa provides highlights which we can use as cited_text
    cited_text: result.highlights?.[0] || result.text?.substring(0, 200),
    publishedDate: result.publishedDate,
    author: result.author,
  }));
};

// Main search function using Exa
export const searchWithExa = async (
  ctx: ActionCtx,
  apiKey: string,
  args: ExaSearchArgs
): Promise<{
  citations: Citation[];
  sources: WebSource[];
  rawResults: any;
}> => {
  try {
    const exa = createExaClient(apiKey);

    // Default search configuration
    const searchOptions = {
      numResults: args.maxResults || 5,
      type: args.searchType || "neural",
      useAutoprompt: true, // Let Exa optimize the query
      category: args.category,
      includeText: args.includeText ?? true,
      includeHighlights: args.includeHighlights ?? true,
      includeImages: true,
      startPublishedDate: undefined, // Could add date filtering
      endPublishedDate: undefined,
    };

    // Perform the search
    const searchResults = await exa.search(args.query, searchOptions);

    // Convert to our formats
    const citations = exaResultsToCitations(searchResults.results);
    const sources: WebSource[] = searchResults.results.map(result => ({
      url: result.url,
      title: result.title,
      snippet: result.text || result.snippet,
      description: result.text,
    }));

    return {
      citations,
      sources,
      rawResults: searchResults,
    };
  } catch (error) {
    console.error("Exa search error:", error);
    throw new Error(`Failed to search with Exa: ${error.message}`);
  }
};

// Get Exa API key using the same pattern as other providers
export const getExaApiKey = async (
  ctx: ActionCtx
): Promise<string | null> => {
  try {
    // Use the existing getDecryptedApiKey action
    const apiKey = await ctx.runAction(api.apiKeys.getDecryptedApiKey, {
      provider: "exa",
    });
    return apiKey;
  } catch (error) {
    console.error("Error getting Exa API key:", error);
    return null;
  }
};