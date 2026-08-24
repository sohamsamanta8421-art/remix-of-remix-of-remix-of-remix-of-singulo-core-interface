interface PrivacyIndicatorProps {
  cameraActive: boolean;
  /** true once the hand model is stored locally and works offline. */
  modelCached: boolean;
}

/**
 * Small badge stating that camera processing is on-device. Frames are never
 * uploaded — only the model/WASM are fetched (once, then cached).
 */
export function PrivacyIndicator({ cameraActive, modelCached }: PrivacyIndicatorProps) {
  return (
    <div
      data-testid="privacy-indicator"
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${cameraActive ? "animate-pulse bg-primary" : "bg-muted-foreground/50"}`}
      />
      <span>{cameraActive ? "On-device · no video uploaded" : "Camera off"}</span>
      <span className="text-primary/80">{modelCached ? "Model cached" : "Model online"}</span>
    </div>
  );
}
