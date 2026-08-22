import { useEffect, useState } from "react";
import type { SinguloCoreEngine } from "@/visual/core-engine";

type Metrics = ReturnType<SinguloCoreEngine["getMetrics"]>;

/**
 * Lightweight profiling readout for the pan/zoom/rotation loop.
 * Polls the engine four times a second — no per-frame React work.
 */
export function PerfOverlay({ getEngine }: { getEngine: () => SinguloCoreEngine | null }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const id = setInterval(() => setMetrics(getEngine()?.getMetrics() ?? null), 250);
    return () => clearInterval(id);
  }, [getEngine]);

  if (!metrics) return null;
  const fps = Math.round(metrics.fps);
  const tone =
    fps >= 55 ? "text-primary" : fps >= 35 ? "text-foreground" : "text-destructive";

  return (
    <section
      aria-label="Performance profiler"
      className="pointer-events-none absolute right-4 top-16 w-44 rounded-lg border border-border/60 bg-card/70 p-3 font-mono text-[10px] leading-relaxed backdrop-blur sm:right-6"
    >
      <p className="mb-1 tracking-[0.2em] text-muted-foreground uppercase">Profiler</p>
      <dl className="space-y-0.5">
        <Stat label="FPS" value={String(fps)} className={tone} />
        <Stat label="Frame" value={`${metrics.frameMs.toFixed(1)} ms`} />
        <Stat label="Loop" value={`${metrics.loopMs.toFixed(2)} ms`} />
        <Stat label="Input lag" value={`${Math.max(0, metrics.inputLatencyMs).toFixed(1)} ms`} />
        <Stat label="Settle" value={metrics.settleError.toFixed(3)} />
        <Stat label="Zoom" value={metrics.zoom.toFixed(2)} />
        <Stat
          label="Pan"
          value={`${metrics.pan.x.toFixed(2)}, ${metrics.pan.y.toFixed(2)}`}
        />
        <Stat
          label="Rot"
          value={`${metrics.rotation.x.toFixed(2)}, ${metrics.rotation.y.toFixed(2)}`}
        />
        <Stat label="State" value={metrics.recentering ? "recentering" : "held"} />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  className = "text-foreground",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}
