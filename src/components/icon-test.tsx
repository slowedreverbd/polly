import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CopyIcon,
  HeartIcon,
  NotePencilIcon,
  SpeakerHighIcon,
  TrashIcon,
} from "@phosphor-icons/react";

export const IconTest = () => {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Icon Test Component</h2>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 p-2 border rounded">
          <HeartIcon className="h-4 w-4" />
          <span>Heart Icon</span>
        </div>

        <div className="flex items-center gap-2 p-2 border rounded">
          <CopyIcon className="h-4 w-4" />
          <span>Copy Icon</span>
        </div>

        <div className="flex items-center gap-2 p-2 border rounded">
          <NotePencilIcon className="h-4 w-4" />
          <span>Edit Icon</span>
        </div>

        <div className="flex items-center gap-2 p-2 border rounded">
          <TrashIcon className="h-4 w-4" />
          <span>Delete Icon</span>
        </div>

        <div className="flex items-center gap-2 p-2 border rounded">
          <SpeakerHighIcon className="h-4 w-4" />
          <span>Speaker Icon</span>
        </div>

        <div className="flex items-center gap-2 p-2 border rounded">
          <CheckIcon className="h-4 w-4" />
          <span>Check Icon</span>
        </div>

        <div className="flex items-center gap-2 p-2 border rounded">
          <ArrowCounterClockwiseIcon className="h-4 w-4" />
          <span>Retry Icon</span>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          This component tests if all the phosphor icons are rendering
          correctly.
        </p>
        <p>
          If you can see all the icons above, the icon library is working
          properly.
        </p>
      </div>
    </div>
  );
};
