interface ChromeTriggerProps {
  open: boolean;
  onToggle: () => void;
  /** id of the region this trigger expands. */
  controls?: string;
}

/**
 * The single small dot that reveals all header chrome. Keyboard focusable,
 * fully labelled, with explicit hover / active / focus states.
 */
export function ChromeTrigger({ open, onToggle, controls = "singulo-chrome" }: ChromeTriggerProps) {
  const label = open ? "Hide interface controls" : "Show interface controls";
  return (
    <button
      type="button"
      data-testid="chrome-trigger"
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      aria-keyshortcuts="c"
      title={`${label} (C)`}
      onClick={onToggle}
      className="pointer-events-auto group -m-1 flex min-h-11 min-w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full border transition-all duration-150 group-hover:scale-150 group-active:scale-90 group-focus-visible:scale-150 ${
          open
            ? "border-primary bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
            : "border-border/70 bg-foreground/25 group-hover:border-primary group-hover:bg-primary/80"
        }`}
      />
      <span className="sr-only">
        {open ? "Interface controls visible" : "Interface controls hidden"}
      </span>
    </button>
  );
}
