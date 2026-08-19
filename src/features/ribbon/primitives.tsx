import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Height of a strip's control row, and of every control in it.
 *
 * The ribbon used to speak two dialects: a 56px icon-over-label button on the
 * Connect, Data, Tools and Memory strips, and a 28px pill everywhere else — so
 * "Connect" and "Autopwn" are the same kind of thing but looked nothing alike.
 * There is now one control size. Emphasis comes from the button's variant, not
 * from making one command twice the size of its neighbours.
 */
const CONTROL_HEIGHT = "h-7";

/** Caption above a group, matching the workspace switcher's group captions. */
const GROUP_LABEL = "px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/55";

/**
 * A whole group: caption plus one control row. The ribbon floors itself at this
 * so a strip with little to show leaves the band exactly as tall as a full one,
 * and the workspace below never shifts when you switch strips.
 */
export const RIBBON_ROW_MIN_HEIGHT = "min-h-[2.875rem]";

/** Shared geometry for anything that sits in a group's control row. */
export const RIBBON_CONTROL = cn(
  CONTROL_HEIGHT,
  "shrink-0 gap-1.5 whitespace-nowrap px-2 text-xs [&_svg]:size-3.5",
);

interface RibbonButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** `default` marks the one recommended action in a group; the rest stay outline. */
  variant?: "default" | "secondary" | "outline" | "ghost";
}

/** The only command button in the ribbon. */
export function RibbonButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "outline",
}: RibbonButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={RIBBON_CONTROL}
    >
      {icon}
      {label}
    </Button>
  );
}

interface RibbonUploadButtonProps {
  icon: ReactNode;
  label: string;
  onFiles: (files: FileList | null) => void;
  /** `accept` attribute; omit for a directory picker. */
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost";
}

/**
 * A command button that opens a file picker. Same pill as {@link RibbonButton}
 * — the hidden input sits on top of it — so importing a dump does not look like
 * a different class of control from dumping one.
 */
export function RibbonUploadButton({
  icon,
  label,
  onFiles,
  accept,
  multiple,
  directory,
  variant = "outline",
}: RibbonUploadButtonProps) {
  return (
    <Button
      asChild
      variant={variant}
      size="sm"
      className={cn(RIBBON_CONTROL, "relative cursor-pointer overflow-hidden")}
    >
      <label>
        {icon}
        {label}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          // webkitdirectory is non-standard but the only way to pick a folder.
          {...(directory ? { webkitdirectory: "" } : {})}
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = "";
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </Button>
  );
}

/**
 * Root of every command strip.
 *
 * Strips used to bring their own scroll container, alignment and gap — three
 * variants across sixteen files — so the ribbon shifted under the cursor as you
 * moved between them. The scrolling now belongs to the ribbon itself; a strip
 * only says what is in it.
 */
export function RibbonStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-max items-stretch gap-2", className)}>{children}</div>;
}

/** The rule between two groups in a strip. */
export function RibbonDivider() {
  return <Separator orientation="vertical" className={cn(CONTROL_HEIGHT, "shrink-0 self-end")} />;
}

/**
 * A titled cluster of controls — buttons, a select, a badge. One shape for
 * every group, whatever it holds.
 */
export function RibbonGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <span className={GROUP_LABEL}>{title}</span>
      <div className={cn("flex items-center gap-1", CONTROL_HEIGHT)}>{children}</div>
    </div>
  );
}

/** Explanatory text in a strip, aligned to the control row rather than the caption. */
export function RibbonNote({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-sm shrink-0 self-center text-pretty px-1 text-xs leading-snug text-muted-foreground">
      {children}
    </p>
  );
}
