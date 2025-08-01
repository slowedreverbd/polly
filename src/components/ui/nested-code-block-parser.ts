/**
 * Custom parser for handling nested code blocks properly
 *
 * The @llm-ui/code library uses a non-greedy regex that matches the first
 * closing ``` instead of the matching one, causing issues with nested code blocks.
 * This parser properly handles nesting by tracking opening/closing pairs.
 */

import type { CodeBlockMatch } from "@/types";

/**
 * Parse nested code blocks from markdown text
 * Optimized for performance with single-pass parsing
 */
export function parseNestedCodeBlocks(
  text: string,
  firstOnly = false
): CodeBlockMatch[] {
  const result: CodeBlockMatch[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    // Fast scan for next ```
    const openPos = text.indexOf("```", i);
    if (openPos === -1) {
      break;
    }

    // Find end of opening line
    let openLineEnd = openPos + 3;
    while (openLineEnd < len && text[openLineEnd] !== "\n") {
      openLineEnd++;
    }
    if (openLineEnd >= len) {
      break;
    }

    // Extract language (avoid substring until needed)
    const language = text.slice(openPos + 3, openLineEnd).trim();

    // Single-pass parsing with character-by-character scanning
    let pos = openLineEnd + 1;
    let nestingLevel = 1;
    let closePos = -1;

    while (pos < len && nestingLevel > 0) {
      // Fast scan to next ```
      const nextTriple = text.indexOf("```", pos);
      if (nextTriple === -1) {
        break;
      }

      // Check if it's at line start (avoid lastIndexOf)
      let lineStart = nextTriple;
      while (lineStart > 0 && text[lineStart - 1] !== "\n") {
        lineStart--;
      }

      // Quick check: is there only whitespace before ```?
      let isLineStart = true;
      for (let j = lineStart; j < nextTriple; j++) {
        if (text[j] !== " " && text[j] !== "\t") {
          isLineStart = false;
          break;
        }
      }

      if (isLineStart) {
        // Find end of this ``` line
        let lineEnd = nextTriple + 3;
        while (lineEnd < len && text[lineEnd] !== "\n") {
          lineEnd++;
        }

        // Check if there's content after ``` (opening) or not (closing)
        const afterContent = text.slice(nextTriple + 3, lineEnd).trim();

        if (afterContent === "") {
          // Closing ```
          nestingLevel--;
          if (nestingLevel === 0) {
            closePos = nextTriple;
            break;
          }
        } else {
          // Opening ``` with language
          nestingLevel++;
        }
      }

      pos = nextTriple + 3;
    }

    // Build result (defer expensive operations)
    if (closePos !== -1) {
      const code = text.slice(openLineEnd + 1, closePos);
      const fullMatch = text.slice(openPos, closePos + 3);

      result.push({
        language,
        code,
        fullMatch,
        start: openPos,
        end: closePos + 3,
      });

      i = closePos + 3;
    } else {
      // Unclosed block
      const code = text.slice(openLineEnd + 1);
      const fullMatch = text.slice(openPos);

      result.push({
        language,
        code,
        fullMatch,
        start: openPos,
        end: len,
      });
      break;
    }

    // Early termination for performance when only first block needed
    if (firstOnly) {
      break;
    }
  }

  return result;
}

/**
 * Extract the first code block from text, handling nested blocks properly
 * Optimized to stop after finding the first block
 */
export function extractFirstCodeBlock(text: string): CodeBlockMatch | null {
  const blocks = parseNestedCodeBlocks(text, true); // firstOnly = true
  return blocks.length > 0 ? blocks[0] : null;
}

/**
 * Check if text contains properly nested code blocks
 */
export function hasNestedCodeBlocks(text: string): boolean {
  const blocks = parseNestedCodeBlocks(text);
  return blocks.some(block => block.code.includes("```"));
}

/**
 * Custom matcher functions to replace @llm-ui/code's broken regex matchers
 */

// @llm-ui expected types
interface LLMOutputMatch {
  startIndex: number;
  endIndex: number;
  outputRaw: string;
}

type MaybeLLMOutputMatch = LLMOutputMatch | undefined;

/**
 * Find complete code blocks (for @llm-ui integration)
 * Optimized to only find the first block
 */
export function findCompleteNestedCodeBlock() {
  return (text: string): MaybeLLMOutputMatch => {
    const blocks = parseNestedCodeBlocks(text, true); // firstOnly = true
    if (blocks.length === 0) {
      return undefined;
    }

    const firstBlock = blocks[0];
    return {
      startIndex: firstBlock.start,
      endIndex: firstBlock.end,
      outputRaw: firstBlock.fullMatch,
    };
  };
}

/**
 * Find partial code blocks during streaming (for @llm-ui integration)
 * Optimized for streaming with early termination
 */
export function findPartialNestedCodeBlock() {
  return (text: string): MaybeLLMOutputMatch => {
    // Look for opening ``` that might not be closed yet
    const openPos = text.indexOf("```");
    if (openPos === -1) {
      return undefined;
    }

    // Check if we have a complete block first (optimized)
    const completeBlocks = parseNestedCodeBlocks(text, true); // firstOnly = true
    if (completeBlocks.length > 0) {
      const firstBlock = completeBlocks[0];
      return {
        startIndex: firstBlock.start,
        endIndex: firstBlock.end,
        outputRaw: firstBlock.fullMatch,
      };
    }

    // Return partial match starting from the opening ```
    return {
      startIndex: openPos,
      endIndex: text.length,
      outputRaw: text.slice(openPos), // use slice instead of substring
    };
  };
}

/**
 * Custom lookBack function for @llm-ui integration
 * Optimized to only parse the first block
 */
export function nestedCodeBlockLookBack() {
  return ({
    output,
    visibleTextLengthTarget,
  }: {
    output: string;
    isComplete: boolean;
    visibleTextLengthTarget: number;
    isStreamFinished: boolean;
  }) => {
    const blocks = parseNestedCodeBlocks(output, true); // firstOnly = true
    if (blocks.length === 0) {
      return {
        output: output.slice(0, visibleTextLengthTarget),
        visibleText: output.slice(0, visibleTextLengthTarget),
      };
    }

    const block = blocks[0];
    const visibleCode = block.code.slice(0, visibleTextLengthTarget);
    const language = block.language || "";

    return {
      output: `\`\`\`${language}\n${visibleCode}\n\`\`\``,
      visibleText: visibleCode,
    };
  };
}
