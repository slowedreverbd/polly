import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  TextAlignJustifyIcon,
} from "@phosphor-icons/react";
import { Highlight } from "prism-react-renderer";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";
import { darkSyntaxTheme, lightSyntaxTheme } from "@/lib/syntax-themes";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-context";

type CodeBlockProps = {
  code: string;
  language?: string;
  className?: string;
};

const CodeBlockComponent = ({
  code,
  language = "text",
  className,
}: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const { theme } = useTheme();
  const managedToast = useToast();
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const headerButtonClass =
    "h-7 w-7 rounded border border-border/60 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

  const processedCode = code;
  const processedLanguage = language;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(processedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      managedToast.error("Failed to copy code", {
        description: "Unable to copy code to clipboard. Please try again.",
      });
    }
  }, [processedCode, managedToast]);

  const handleDownload = () => {
    const blob = new Blob([processedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${getFileExtension(processedLanguage)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (lang: string): string => {
    const extensions: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      java: "java",
      cpp: "cpp",
      c: "c",
      csharp: "cs",
      php: "php",
      ruby: "rb",
      go: "go",
      rust: "rs",
      swift: "swift",
      kotlin: "kt",
      scala: "scala",
      html: "html",
      css: "css",
      scss: "scss",
      less: "less",
      json: "json",
      xml: "xml",
      yaml: "yml",
      yml: "yml",
      sql: "sql",
      bash: "sh",
      shell: "sh",
      powershell: "ps1",
      dockerfile: "dockerfile",
      markdown: "md",
      text: "txt",
    };
    return extensions[lang.toLowerCase()] || "txt";
  };

  // Handle keyboard shortcut for copying (Cmd+Shift+C / Ctrl+Shift+C)
  useEffect(() => {
    const element = componentRef.current;
    if (!element) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const rect = element.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key === "C" &&
        isVisible
      ) {
        e.preventDefault();
        handleCopy();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCopy]);

  // Defer heavy Prism highlighting until the block is near the viewport
  useEffect(() => {
    const node = codeContainerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "group relative mt-2 w-[calc(100%+24px)] max-w-none sm:w-[calc(100%+48px)]",
        "mx-[-12px] sm:mx-[-24px]",
        className
      )}
      ref={componentRef}
    >
      <div className="rounded-xl border border-border/60 bg-surface-variant/90 dark:bg-surface/70 shadow-sm">
        {/* Header with language and actions */}
        <div className="flex h-9 items-center justify-between rounded-t-xl border-b border-border/60 bg-surface-variant/80 dark:bg-surface/60 backdrop-blur-xs px-3 text-[13px] sm:px-6">
          <span className="font-mono font-medium text-muted-foreground">
            {processedLanguage || "text"}
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={headerButtonClass}
                  size="sm"
                  variant="ghost"
                  onClick={handleDownload}
                >
                  <DownloadIcon className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download code</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    headerButtonClass,
                    wordWrap && "bg-accent/40 text-foreground border-accent/40"
                  )}
                  onClick={() => setWordWrap(!wordWrap)}
                >
                  <TextAlignJustifyIcon className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{wordWrap ? "Disable word wrap" : "Enable word wrap"}</p>
              </TooltipContent>
            </Tooltip>
            <span
              aria-hidden="true"
              className="inline-block h-7 w-7 rounded border border-transparent"
            />
          </div>
        </div>
        <div className="relative">
          {/* Sticky copy button - positioned to align with header buttons */}
          <div className="pointer-events-none sticky top-[42px] z-[3] h-0">
            <div className="pointer-events-auto absolute -top-8 right-3 sm:right-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className={headerButtonClass}
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                    aria-label="Copy code to clipboard"
                  >
                    <div className="relative h-4 w-4">
                      {copied ? (
                        <CheckIcon className="absolute inset-0 h-3 w-3 text-primary transition-all duration-200" />
                      ) : (
                        <CopyIcon className="absolute inset-0 h-3 w-3 transition-all duration-200" />
                      )}
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy code (Cmd+Shift+C)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Code content */}
          <div ref={codeContainerRef} className="relative pt-3">
            {isVisible ? (
              <Highlight
                code={processedCode.trim()}
                language={processedLanguage}
                theme={theme === "dark" ? darkSyntaxTheme : lightSyntaxTheme}
              >
                {({
                  className: highlightClassName,
                  style,
                  tokens,
                  getLineProps,
                  getTokenProps,
                }) => (
                  <pre
                    className={cn(
                      highlightClassName,
                      "m-0 overflow-x-auto py-4 px-3 text-[14px] leading-[1.7] font-mono sm:px-6 sm:text-[15px]",
                      wordWrap &&
                        "whitespace-pre-wrap break-words overflow-x-visible"
                    )}
                    style={{
                      ...style,
                      backgroundColor: "transparent",
                    }}
                  >
                    {tokens.map((line, i) => (
                      <div key={`line-${i}`} {...getLineProps({ line })}>
                        {line.map((token, key) => (
                          <span
                            key={`token-${i}-${key}`}
                            {...getTokenProps({ token })}
                          />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            ) : (
              <pre
                className={cn(
                  "m-0 overflow-x-auto py-4 px-3 text-[14px] font-mono leading-[1.7] opacity-60 sm:px-6 sm:text-[15px]",
                  wordWrap &&
                    "whitespace-pre-wrap break-words overflow-x-visible"
                )}
              >
                {processedCode.trim()}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CodeBlock = memo(CodeBlockComponent);
