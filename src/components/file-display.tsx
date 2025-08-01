import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  FileCodeIcon,
  FilePdfIcon,
  FileTextIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { Spinner } from "@/components/spinner";
import type { Attachment } from "@/types";

function getFileIcon(
  attachment: Attachment,
  size: "sm" | "md" = "md",
  className?: string
) {
  const defaultSizeClasses = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const sizeClasses = className
    ? `${className} flex-shrink-0`
    : defaultSizeClasses;

  if (attachment.type === "pdf") {
    return <FilePdfIcon className={`${sizeClasses} text-muted-foreground`} />;
  }

  if (attachment.type === "text") {
    const extension = attachment.name.split(".").pop()?.toLowerCase();

    const isTextFile =
      extension &&
      [
        "txt",
        "text",
        "md",
        "markdown",
        "mdx",
        "rtf",
        "log",
        "csv",
        "tsv",
      ].includes(extension);

    if (isTextFile) {
      return (
        <FileTextIcon className={`${sizeClasses} text-muted-foreground`} />
      );
    }

    return <FileCodeIcon className={`${sizeClasses} text-muted-foreground`} />;
  }

  return <PaperclipIcon className={`${sizeClasses} text-muted-foreground`} />;
}

type FileDisplayProps = {
  attachment: Attachment;
  className?: string;
  onClick?: () => void;
};

export const FileDisplay = ({
  attachment,
  className = "",
  onClick,
}: FileDisplayProps) => {
  // If we have a storageId, get the URL from Convex
  const convexFileUrl = useQuery(
    api.fileStorage.getFileUrl,
    attachment.storageId
      ? { storageId: attachment.storageId as Id<"_storage"> }
      : "skip"
  );

  // Determine the actual URL to use
  let fileUrl = attachment.storageId ? convexFileUrl : attachment.url;

  // For private mode files with Base64 content, create a data URL
  if (!fileUrl && attachment.content && attachment.mimeType) {
    fileUrl = `data:${attachment.mimeType};base64,${attachment.content}`;
  }

  // Show loading state for Convex files
  if (attachment.storageId && convexFileUrl === undefined) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/20 ${className}`}
      >
        <Spinner size="sm" className="opacity-60" />
      </div>
    );
  }

  // Show error state if Convex file URL failed to load
  if (attachment.storageId && convexFileUrl === null) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/20 ${className}`}
      >
        <div className="text-xs text-muted-foreground">Failed to load</div>
      </div>
    );
  }

  if (attachment.type === "image" && fileUrl) {
    return (
      <div
        className={`overflow-hidden rounded-xl border border-border/20 shadow-sm ${className}`}
      >
        <img
          alt={attachment.name}
          className="h-auto w-full max-w-sm cursor-pointer object-cover"
          loading="lazy"
          src={fileUrl}
          style={{ maxHeight: "300px" }}
          onClick={onClick}
          onKeyDown={e => {
            if (onClick && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onClick();
            }
          }}
          role={onClick ? "button" : undefined}
          tabIndex={onClick ? 0 : undefined}
        />
      </div>
    );
  }

  // For non-image files, show a file icon with name
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-3 py-1 text-xs ${
        attachment.type === "pdf"
          ? "cursor-pointer hover:bg-muted/50 transition-colors"
          : ""
      } ${className}`}
      onClick={attachment.type === "pdf" ? onClick : undefined}
      onKeyDown={e => {
        if (
          attachment.type === "pdf" &&
          onClick &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onClick();
        }
      }}
      role={attachment.type === "pdf" && onClick ? "button" : undefined}
      tabIndex={attachment.type === "pdf" && onClick ? 0 : undefined}
    >
      {getFileIcon(attachment)}
      <span className="text-foreground selectable-text">{attachment.name}</span>
    </div>
  );
};

type ImageThumbnailProps = {
  attachment: Attachment;
  className?: string;
  onClick?: () => void;
};

export const ImageThumbnail = ({
  attachment,
  className = "",
  onClick,
}: ImageThumbnailProps) => {
  // If we have a storageId, get the URL from Convex
  const convexFileUrl = useQuery(
    api.fileStorage.getFileUrl,
    attachment.storageId
      ? { storageId: attachment.storageId as Id<"_storage"> }
      : "skip"
  );

  // For thumbnails, prefer local thumbnail if available, then Convex URL, then fallback URL
  let thumbnailUrl =
    attachment.thumbnail ||
    (attachment.storageId ? convexFileUrl : attachment.url);

  // For private mode files with Base64 content, create a data URL
  if (!thumbnailUrl && attachment.content && attachment.mimeType) {
    thumbnailUrl = `data:${attachment.mimeType};base64,${attachment.content}`;
  }

  if (attachment.storageId && !thumbnailUrl) {
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 ${className}`}
      >
        <Spinner size="sm" className="h-3 w-3 opacity-60" />
      </div>
    );
  }

  if (attachment.type === "image" && thumbnailUrl) {
    return (
      <div
        className={`relative flex-shrink-0 cursor-pointer overflow-hidden rounded bg-white shadow-sm ring-1 ring-black/5 dark:bg-slate-800 dark:ring-white/10 ${className}`}
        title={attachment.name}
        onClick={onClick}
        onKeyDown={e => {
          if (onClick && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <img
          alt={attachment.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          src={thumbnailUrl}
        />
      </div>
    );
  }

  return getFileIcon(attachment, "sm", className);
};
