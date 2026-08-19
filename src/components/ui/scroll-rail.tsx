import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollRailProps {
  children: React.ReactNode;
  /** Applied to the outer, position-relative box. */
  className?: string;
  /** Applied to the scrolling flex row that actually holds `children`. */
  contentClassName?: string;
  /** Forwarded to the scrolling row, which is the element that owns the role. */
  role?: string;
  "aria-label"?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}

/** How much of the visible width one nudge of the chevron buttons moves. */
const NUDGE_RATIO = 0.7;

/**
 * A horizontal scroller that tells the truth about what it is hiding.
 *
 * The workbench header holds more workspaces and more commands than any
 * viewport can show, and the old rails hid the surplus behind a decorative
 * fade that was painted whether or not anything was actually clipped. Here the
 * fade and its nudge button appear only on a side that genuinely has more
 * content, so a rail that looks flush *is* flush, and a rail that is clipped
 * always says so.
 */
export function ScrollRail({
  children,
  className,
  contentClassName,
  role,
  onKeyDown,
  ...rest
}: ScrollRailProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = React.useState({ start: false, end: false });

  const measure = React.useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    // Sub-pixel layout means scrollLeft rarely lands exactly on the bounds.
    const max = node.scrollWidth - node.clientWidth;
    setOverflow((previous) => {
      const next = { start: node.scrollLeft > 1, end: node.scrollLeft < max - 1 };
      return previous.start === next.start && previous.end === next.end ? previous : next;
    });
  }, []);

  const observerRef = React.useRef<ResizeObserver | null>(null);
  const observedRowRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
      observedRowRef.current = null;
    };
  }, [measure]);

  // Re-measure after every render — swapping strips changes the content width
  // without resizing the scroller — and follow the row element across swaps so
  // a late reflow inside it (web fonts, an async label) still updates the edges.
  React.useLayoutEffect(() => {
    measure();
    const row = scrollerRef.current?.firstElementChild ?? null;
    if (row === observedRowRef.current) return;
    const observer = observerRef.current;
    if (!observer) return;
    if (observedRowRef.current) observer.unobserve(observedRowRef.current);
    if (row) observer.observe(row);
    observedRowRef.current = row;
  });

  const nudge = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * NUDGE_RATIO, behavior: "smooth" });
  };

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <div
        ref={scrollerRef}
        onScroll={measure}
        onKeyDown={onKeyDown}
        role={role}
        aria-label={rest["aria-label"]}
        className={cn("flex min-w-0 overflow-x-auto scrollbar-hide", contentClassName)}
      >
        {children}
      </div>

      <RailEdge side="start" visible={overflow.start} onNudge={() => nudge(-1)} />
      <RailEdge side="end" visible={overflow.end} onNudge={() => nudge(1)} />
    </div>
  );
}

function RailEdge({
  side,
  visible,
  onNudge,
}: {
  side: "start" | "end";
  visible: boolean;
  onNudge: () => void;
}) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none absolute inset-y-0 flex w-10 items-center transition-opacity duration-150",
        side === "start"
          ? "left-0 justify-start bg-gradient-to-r from-card via-card/80 to-transparent"
          : "right-0 justify-end bg-gradient-to-l from-card via-card/80 to-transparent",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={side === "start" ? "Scroll left" : "Scroll right"}
        onClick={onNudge}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <Icon className="h-3 w-3" />
      </button>
    </div>
  );
}

export default ScrollRail;
