# Exa.ai Web Search Integration

This application now uses [Exa.ai](https://exa.ai) as the unified web search provider for all AI models, replacing provider-specific web search implementations.

## Overview

Previously, web search was implemented differently for each AI provider:
- **Google**: Used `useSearchGrounding` parameter
- **OpenRouter**: Added `:online` suffix to model names
- **Other providers**: No web search support

With Exa integration, all providers now use the same high-quality neural search engine, providing:
- Consistent search results across all AI models
- Better search quality with neural/semantic search
- Simplified codebase with unified implementation
- Support for various search categories (research papers, news, GitHub, etc.)

## Setup

### 1. Get an Exa API Key

1. Visit [https://dashboard.exa.ai](https://dashboard.exa.ai)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key

### 2. Add Your API Key

You can add your Exa API key in two ways:

#### Option A: Environment Variable (Recommended for deployment)
```bash
EXA_API_KEY=your-exa-api-key-here
```

#### Option B: Through the UI
1. Go to Settings → API Keys
2. Find the Exa card
3. Enter your API key and click Save

## How It Works

When web search is enabled for a conversation:

1. **Query Extraction**: The last user message is used as the search query
2. **Exa Search**: A neural search is performed using Exa's API
3. **Context Injection**: Search results are formatted and added as system context
4. **Citation Storage**: Search results are stored as citations on the assistant's response
5. **Metadata Enrichment**: Citations are enriched with OpenGraph data in the background

## Features

### Search Types
- **Neural Search** (default): Semantic search that understands intent
- **Keyword Search**: Traditional keyword-based search

### Search Categories
Exa supports filtering by content type:
- Company websites
- Research papers
- News articles
- GitHub repositories
- Tweets
- Movies
- Songs
- Personal sites
- PDFs

### Search Configuration
- **Max Results**: Configurable number of results (default: 5)
- **Include Text**: Get full text content from pages
- **Include Highlights**: Get relevant text highlights

## Implementation Details

### Key Files Modified

1. **`convex/ai/exa.ts`**: New Exa integration module
2. **`convex/ai.ts`**: Modified to use Exa for all web search
3. **`convex/apiKeys.ts`**: Added Exa API key support
4. **`convex/schema.ts`**: Added Exa as a provider type
5. **`src/components/settings/api-keys-tab.tsx`**: Added Exa to UI
6. **`src/lib/validation.ts`**: Added Exa key validation

### Removed Features
- Provider-specific web search implementations
- Google's `useSearchGrounding`
- OpenRouter's `:online` suffix

## Benefits

1. **Consistency**: Same search experience across all AI providers
2. **Quality**: Exa's neural search often provides more relevant results
3. **Simplicity**: One integration to maintain instead of multiple
4. **Features**: Access to Exa's advanced search capabilities
5. **Cost-Effective**: Pay for search separately from AI inference

## Troubleshooting

### No search results appearing
- Verify your Exa API key is correctly configured
- Check the browser console for any error messages
- Ensure web search is enabled for the conversation

### Search errors
- Check your Exa API key validity
- Verify you have remaining API credits in your Exa account
- Review the error message in the console logs

## Future Enhancements

Potential improvements to consider:
- Add search filters in the UI (categories, date ranges)
- Allow users to preview/select which search results to include
- Implement search result caching
- Add support for Exa's similarity search
- Enable custom search prompts

## API Usage

Exa API usage is separate from your AI provider usage. Monitor your usage at [https://dashboard.exa.ai](https://dashboard.exa.ai).