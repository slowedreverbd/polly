import { api } from "@convex/_generated/api";
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ArrowsOutIcon,
  SmileyIcon,
  SparkleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useAction } from "convex/react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SkeletonText } from "@/components/ui/skeleton-text";
import { Textarea } from "@/components/ui/textarea";
import { useWordBasedUndo } from "./use-word-based-undo";

export type PersonaFormData = {
  name: string;
  description: string;
  prompt: string;
  icon: string;
};

type PersonaFormProps = {
  formData: PersonaFormData;
  setFormData: React.Dispatch<React.SetStateAction<PersonaFormData | null>>;
  isEmojiPickerOpen: boolean;
  setIsEmojiPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleEmojiClick: (emojiData: EmojiClickData) => void;
};

export const PersonaForm = ({
  formData,
  setFormData,
  isEmojiPickerOpen,
  setIsEmojiPickerOpen,
  handleEmojiClick,
}: PersonaFormProps) => {
  const [isFullScreenEditor, setIsFullScreenEditor] = useState(false);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const improvePromptAction = useAction(api.personas.improvePrompt);

  const updateFormField = useCallback(
    (field: keyof PersonaFormData, value: string) => {
      setFormData(prev => (prev ? { ...prev, [field]: value } : null));
    },
    [setFormData]
  );

  const {
    value: promptValue,
    updateValue: setPromptValue,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWordBasedUndo({
    initialValue: formData.prompt,
    debounceMs: 1000,
  });

  const handlePromptChange = useCallback(
    (newValue: string) => {
      setPromptValue(newValue);
      updateFormField("prompt", newValue);
    },
    [setPromptValue, updateFormField]
  );

  const handleImprovePrompt = useCallback(async () => {
    if (!promptValue.trim()) {
      toast.error("No prompt to improve", {
        description: "Please enter a prompt first before trying to improve it.",
      });
      return;
    }

    setIsImprovingPrompt(true);
    try {
      const result = await improvePromptAction({ prompt: promptValue });
      if (result.improvedPrompt) {
        handlePromptChange(result.improvedPrompt);
        toast.success("Prompt improved!", {
          description: "Your prompt has been enhanced with AI suggestions.",
        });
      }
    } catch (_error) {
      toast.error("Failed to improve prompt", {
        description: "Unable to improve the prompt. Please try again.",
      });
    } finally {
      setIsImprovingPrompt(false);
    }
  }, [promptValue, improvePromptAction, handlePromptChange]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      {/* Left Column - Basic Information */}
      <div className="space-y-6">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Basic Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium" htmlFor="name">
                Name
              </Label>
              <Input
                className="h-10"
                id="name"
                placeholder="e.g., Creative Writer"
                value={formData.name}
                onChange={e => updateFormField("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium" htmlFor="description">
                Description{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                className="h-10"
                id="description"
                placeholder="e.g., Imaginative storyteller and creative writing assistant"
                value={formData.description}
                onChange={e => updateFormField("description", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Icon Selection Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Icon</h3>
          <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border-2 bg-background shadow-sm">
              <span
                className="absolute select-none text-3xl"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  lineHeight: 1,
                  fontFamily:
                    "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
                }}
              >
                {formData.icon}
              </span>
            </div>
            <div className="flex-1">
              <p className="mb-3 text-sm text-muted-foreground">
                Choose an emoji to represent your persona
              </p>
              <Popover
                open={isEmojiPickerOpen}
                onOpenChange={setIsEmojiPickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button size="default" variant="outline">
                    <SmileyIcon className="mr-2 h-4 w-4" />
                    Choose Emoji
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <EmojiPicker
                    skinTonesDisabled
                    height={400}
                    searchDisabled={false}
                    width={350}
                    onEmojiClick={handleEmojiClick}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - System Prompt */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Personality & Instructions</h2>
          <Button
            className="gap-2"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setIsFullScreenEditor(true)}
          >
            <ArrowsOutIcon className="h-4 w-4" />
            Fullscreen Editor
          </Button>
        </div>
        <div className="space-y-3">
          <div className="group relative rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <Textarea
              className="min-h-[300px] resize-none rounded-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-base"
              id="prompt"
              placeholder="Describe how you want your AI assistant to behave and respond. For example: 'You are a creative writing assistant who helps users brainstorm ideas, develop characters, and craft compelling stories. Be encouraging, imaginative, and offer specific suggestions.'"
              rows={12}
              value={promptValue}
              onChange={e => handlePromptChange(e.target.value)}
            />

            {isImprovingPrompt && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background">
                <div className="relative h-full w-full overflow-hidden">
                  <SkeletonText className="absolute inset-0 opacity-80" />
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-transparent via-background/50 to-transparent" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background px-4 py-2 shadow-lg">
                      <Spinner size="sm" />
                      <span className="gradient-text text-sm font-medium">
                        AI magic in progress...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Prompt Controls */}
            <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 p-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    className="h-7 w-7 p-0"
                    disabled={!canUndo || isImprovingPrompt}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={undo}
                  >
                    <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    className="h-7 w-7 p-0"
                    disabled={!canRedo || isImprovingPrompt}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={redo}
                  >
                    <ArrowClockwiseIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Button
                className="gap-2 text-xs"
                disabled={!promptValue.trim() || isImprovingPrompt}
                size="sm"
                type="button"
                variant="outline"
                onClick={handleImprovePrompt}
              >
                {isImprovingPrompt ? (
                  <>
                    <Spinner size="sm" />
                    Improving...
                  </>
                ) : (
                  <>
                    <SparkleIcon className="h-3.5 w-3.5" />
                    Improve prompt
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Define your assistant&apos;s personality, tone, and expertise. This
            guides how it will respond in conversations. Use the{" "}
            <Button
              className="h-auto p-0 text-xs text-blue-500 underline hover:text-blue-600"
              disabled={!promptValue.trim() || isImprovingPrompt}
              size="sm"
              type="button"
              variant="link"
              onClick={handleImprovePrompt}
            >
              improve prompt
            </Button>{" "}
            feature to transform simple ideas into structured prompts. Need more
            help?{" "}
            <a
              className="text-blue-500 underline transition-colors hover:text-blue-600"
              href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts"
              rel="noopener noreferrer"
              target="_blank"
            >
              Check out this system prompts guide
            </a>{" "}
            for tips and best practices.
          </p>
        </div>
      </div>

      {isFullScreenEditor && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <div className="flex flex-shrink-0 flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start sm:gap-4">
              <h2 className="truncate text-lg font-semibold">
                <span className="hidden sm:inline">
                  Personality & Instructions
                </span>
                <span className="sm:hidden">Edit Prompt</span>
              </h2>
              <Button
                className="h-8 w-8 flex-shrink-0 p-0 sm:hidden"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setIsFullScreenEditor(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-4">
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-1 sm:flex">
                  <Button
                    className="h-8 w-8 p-0"
                    disabled={!canUndo || isImprovingPrompt}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={undo}
                  >
                    <ArrowCounterClockwiseIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    className="h-8 w-8 p-0"
                    disabled={!canRedo || isImprovingPrompt}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={redo}
                  >
                    <ArrowClockwiseIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  className="gap-1 sm:gap-2"
                  disabled={!promptValue.trim() || isImprovingPrompt}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleImprovePrompt}
                >
                  {isImprovingPrompt ? (
                    <>
                      <Spinner size="sm" />
                      <span className="xs:inline hidden">Improving...</span>
                      <span className="xs:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <SparkleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="xs:inline hidden">Improve prompt</span>
                      <span className="xs:hidden">Improve</span>
                    </>
                  )}
                </Button>
                <Button
                  className="hidden h-8 w-8 flex-shrink-0 p-0 sm:flex"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setIsFullScreenEditor(false)}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="relative min-h-0 flex-1">
            <Textarea
              className="h-full w-full resize-none overflow-y-auto border-0 bg-transparent p-4 pl-[max(1rem,calc(50%-40ch))] pr-[max(1rem,calc(50%-40ch))] font-mono text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 sm:p-6 sm:pl-[max(1.5rem,calc(50%-40ch))] sm:pr-[max(1.5rem,calc(50%-40ch))] sm:text-base lg:p-8 lg:pl-[max(2rem,calc(50%-40ch))] lg:pr-[max(2rem,calc(50%-40ch))]"
              placeholder="Describe how you want your AI assistant to behave and respond..."
              onChange={e => handlePromptChange(e.target.value)}
            >
              {promptValue}
            </Textarea>

            {isImprovingPrompt && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background">
                <div className="relative h-full w-full overflow-hidden px-8">
                  <div
                    className="absolute top-1/2 h-64 -translate-y-1/2 transform opacity-80"
                    style={{
                      left: "max(2rem, calc(50% - 40ch))",
                      right: "max(2rem, calc(50% - 40ch))",
                    }}
                  >
                    <SkeletonText className="h-full" />
                  </div>
                  <div
                    className="absolute top-1/2 h-64 -translate-y-1/2 transform animate-pulse bg-gradient-to-br from-transparent via-background/50 to-transparent"
                    style={{
                      left: "max(2rem, calc(50% - 40ch))",
                      right: "max(2rem, calc(50% - 40ch))",
                    }}
                  />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background px-4 py-2 shadow-lg">
                      <Spinner size="sm" />
                      <span className="gradient-text text-sm font-medium">
                        AI magic in progress...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
