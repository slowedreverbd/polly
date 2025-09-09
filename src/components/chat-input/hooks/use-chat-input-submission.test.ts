import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "../../../test/hook-utils";

vi.mock("convex/react", () => ({ useAction: vi.fn() }));
vi.mock("@/hooks/use-convex-file-upload", () => ({
  useConvexFileUpload: vi.fn(),
}));
vi.mock("@/hooks/use-dialog-management", () => ({
  useNotificationDialog: vi.fn(),
}));
vi.mock("@/hooks/use-reasoning", () => ({ useReasoningConfig: vi.fn() }));
vi.mock("@/providers/private-mode-context", () => ({
  usePrivateMode: vi.fn(),
}));

import type { Id } from "@convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useConvexFileUpload } from "@/hooks/use-convex-file-upload";
import { useNotificationDialog } from "@/hooks/use-dialog-management";
import { useReasoningConfig } from "@/hooks/use-reasoning";
import { usePrivateMode } from "@/providers/private-mode-context";
import type { Attachment } from "@/types";
import { useChatInputSubmission } from "./use-chat-input-submission";

describe("useChatInputSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Basic mocks
    (useAction as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());
    (useConvexFileUpload as ReturnType<typeof vi.fn>).mockReturnValue({
      uploadFile: vi.fn(),
    });
    (useNotificationDialog as ReturnType<typeof vi.fn>).mockReturnValue({
      notify: vi.fn(),
    });
    (useReasoningConfig as ReturnType<typeof vi.fn>).mockReturnValue([
      { enabled: false },
      vi.fn(),
    ]);
    (usePrivateMode as ReturnType<typeof vi.fn>).mockReturnValue({
      isPrivateMode: false,
    });
  });

  it("early returns when input and attachments are empty", async () => {
    const onSendMessage = vi.fn();
    const { result } = renderHook(() =>
      useChatInputSubmission({
        conversationId: "c1" as Id<"conversations">,
        selectedPersonaId: null,
        temperature: 0.5,
        onSendMessage,
        onSendAsNewConversation: vi.fn(),
        handleImageGenerationSubmit: vi.fn(),
        handleImageGenerationSendAsNew: vi.fn(),
        onResetInputState: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.submit("   ", [], "text");
    });
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(result.current.isProcessing).toBe(false);
  });

  it("handles image mode submit and resets state; errors show notification", async () => {
    const ok = vi.fn().mockResolvedValue(undefined);
    const onReset = vi.fn();
    const notify = vi.fn();
    (useNotificationDialog as unknown as vi.Mock).mockReturnValue({ notify });
    const { result, rerender } = renderHook(
      ({ handler }) =>
        useChatInputSubmission({
          conversationId: "c1" as Id<"conversations">,
          selectedPersonaId: null,
          onSendMessage: vi.fn(),
          handleImageGenerationSubmit: handler,
          handleImageGenerationSendAsNew: vi.fn(),
          onResetInputState: onReset,
        }),
      { initialProps: { handler: ok } }
    );

    await act(async () => {
      await result.current.submit("hello", [], "image");
    });
    expect(ok).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();

    const bad = vi.fn().mockRejectedValue(new Error("boom"));
    await act(async () => rerender({ handler: bad }));
    await act(async () => {
      await result.current.submit("hello", [], "image");
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error" })
    );
  });

  it("text mode: private mode converts attachments to data URLs and sends with reasoning", async () => {
    (usePrivateMode as unknown as vi.Mock).mockReturnValue({
      isPrivateMode: true,
    });
    (useReasoningConfig as unknown as vi.Mock).mockReturnValue([
      { enabled: true, effort: "medium" },
      vi.fn(),
    ]);

    const onSendMessage = vi.fn();
    const onReset = vi.fn();
    const attText = {
      type: "text" as const,
      content: "SGVsbG8=",
      mimeType: "text/plain",
      name: "a.txt",
      url: "blob:test",
      size: 5,
    };
    const attStored = {
      type: "image" as const,
      storageId: "sid" as Id<"_storage">,
      name: "img.png",
      mimeType: "image/png",
      url: "https://example.com/img.png",
      size: 1024,
    };

    const { result } = renderHook(() =>
      useChatInputSubmission({
        conversationId: "c1" as Id<"conversations">,
        selectedPersonaId: "p1" as Id<"personas">,
        temperature: 0.7,
        onSendMessage,
        handleImageGenerationSubmit: vi.fn(),
        handleImageGenerationSendAsNew: vi.fn(),
        onResetInputState: onReset,
      })
    );

    await act(async () => {
      await result.current.submit("  hi  ", [attText, attStored], "text");
    });

    expect(onSendMessage).toHaveBeenCalled();
    const [, processed, personaId, reasoning, temp] =
      onSendMessage.mock.calls[0];
    expect(personaId).toBe("p1");
    expect(reasoning).toEqual({ enabled: true, effort: "medium" });
    expect(temp).toBe(0.7);
    // Text gets data URL, stored image unchanged
    expect(processed[0]).toMatchObject({
      url: expect.stringContaining("data:text/plain;base64,SGVsbG8="),
      contentType: "text/plain",
    });
    expect(processed[1]).toBe(attStored);
    expect(onReset).toHaveBeenCalled();
  });

  it("text mode: non-private uploads new attachments and preserves pdf extractedText", async () => {
    // atob polyfill for Node
    (globalThis as unknown as { atob: (b64: string) => string }).atob = (
      b64: string
    ) => Buffer.from(b64, "base64").toString("binary");
    const uploadFile = vi
      .fn()
      .mockResolvedValueOnce({
        type: "image",
        storageId: "s1",
        name: "img.png",
        url: "",
        mimeType: "image/png",
        size: 2,
      })
      .mockResolvedValueOnce({
        type: "pdf",
        storageId: "s2",
        name: "doc.pdf",
        url: "",
        mimeType: "application/pdf",
        size: 3,
      });
    (useConvexFileUpload as unknown as vi.Mock).mockReturnValue({ uploadFile });

    const onSendMessage = vi.fn();
    const onReset = vi.fn();
    const attImage: Attachment = {
      type: "image",
      content: "AQID",
      mimeType: "image/png",
      name: "img.png",
      url: "",
      size: 4,
    };
    const attPdf: Attachment = {
      type: "pdf",
      content: "AA==",
      mimeType: "application/pdf",
      name: "doc.pdf",
      extractedText: "pdf text",
      url: "",
      size: 2,
    };
    const attText: Attachment = {
      type: "text",
      content: "abc",
      mimeType: "text/plain",
      name: "a.txt",
      url: "",
      size: 3,
    };

    const { result } = renderHook(() =>
      useChatInputSubmission({
        conversationId: undefined,
        selectedPersonaId: null,
        temperature: undefined,
        onSendMessage,
        handleImageGenerationSubmit: vi.fn(),
        handleImageGenerationSendAsNew: vi.fn(),
        onResetInputState: onReset,
      })
    );

    await act(async () => {
      await result.current.submit(" hey ", [attImage, attPdf, attText], "text");
    });
    expect(uploadFile).toHaveBeenCalledTimes(2);
    const sentAttachments = onSendMessage.mock.calls[0][1];
    expect(sentAttachments[0]).toMatchObject({
      storageId: "s1",
      type: "image",
    });
    expect(sentAttachments[1]).toMatchObject({
      storageId: "s2",
      type: "pdf",
      extractedText: "pdf text",
    });
    expect(sentAttachments[2]).toBe(attText);
    expect(onReset).toHaveBeenCalled();
  });

  it("handleSendAsNewConversation generates summary, uploads, forwards, and resets on success", async () => {
    const genSummary = vi.fn().mockResolvedValue("ctx");
    (useAction as unknown as vi.Mock).mockReturnValue(genSummary);
    const uploadFile = vi
      .fn()
      .mockResolvedValue({ type: "image", storageId: "s1" });
    (useConvexFileUpload as unknown as vi.Mock).mockReturnValue({ uploadFile });

    const onSendAsNewConversation = vi.fn().mockResolvedValue("newC");
    const onReset = vi.fn();
    const { result } = renderHook(() =>
      useChatInputSubmission({
        conversationId: "c1" as Id<"conversations">,
        selectedPersonaId: "p1" as Id<"personas">,
        onSendMessage: vi.fn(),
        onSendAsNewConversation,
        handleImageGenerationSubmit: vi.fn(),
        onResetInputState: onReset,
        handleImageGenerationSendAsNew: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleSendAsNewConversation(
        "question?",
        [
          {
            type: "image",
            content: "AQID",
            mimeType: "image/png",
            name: "a",
            url: "",
            size: 4,
          },
        ],
        true,
        "p2" as Id<"personas">,
        { enabled: true }
      );
    });
    expect(genSummary).toHaveBeenCalled();
    expect(onSendAsNewConversation).toHaveBeenCalledWith(
      "question?",
      true,
      expect.any(Array),
      "ctx",
      "c1",
      "p2",
      { enabled: true },
      undefined
    );
    expect(onReset).toHaveBeenCalled();

    // If it returns undefined, no reset
    onReset.mockClear();
    onSendAsNewConversation.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.handleSendAsNewConversation("q", [], true);
    });
    expect(onReset).not.toHaveBeenCalled();
  });
});
