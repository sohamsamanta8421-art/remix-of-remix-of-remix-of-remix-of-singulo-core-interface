import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SinguloCore } from "@/visual/SinguloCore";
import type { SinguloCoreEngine } from "@/visual/core-engine";
import { hydrateSettings, settingsStore, useSettings } from "@/config/settings";
import { hydrateMemory, useMemory } from "@/lib/memory/store";
import { setAiState, setError, singuloStore, useSingulo } from "@/lib/state/singulo";
import { sendMessage } from "@/lib/ai/conversation";
import { speak, stopSpeaking } from "@/lib/voice/tts";
import { startRecording, type RecorderHandle } from "@/lib/voice/recorder";
import { useGestures } from "@/hooks/use-gestures";
import { SettingsPanel } from "@/components/SettingsPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SINGULO — AI Voice & Gesture Interface" },
      {
        name: "description",
        content:
          "SINGULO is a holographic AI interface driven by voice, hand gestures and a reactive 3D core.",
      },
      { property: "og:title", content: "SINGULO — AI Voice & Gesture Interface" },
      {
        property: "og:description",
        content: "Talk, point and pinch to command a living holographic AI core.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const engineRef = useRef<SinguloCoreEngine | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const levelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [chromeOpen, setChromeOpen] = useState(false);
  const peakRef = useRef(0);
  const aiState = useSingulo((s) => s.aiState);
  const statusLine = useSingulo((s) => s.statusLine);
  const error = useSingulo((s) => s.error);
  const panel = useSingulo((s) => s.panel);
  const pending = useSingulo((s) => s.pending);
  const cameraActive = useSingulo((s) => s.cameraActive);
  const session = useMemory((s) => s.session);
  const lastGesture = useSingulo((s) => s.lastGesture);
  const gestureMode = useSettings((s) => s.gesture.mode);
  const gestureSpeed = useSettings((s) => s.gesture.speed);
  const theme = useSettings((s) => s.appearance.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-blue", theme === "blue");
  }, [theme]);

  useEffect(() => {
    hydrateSettings();
    hydrateMemory();
  }, []);

  const visual = (action: string, amount = 1) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (action === "zoom_in") engine.zoomBy(0.25 * amount);
    else if (action === "zoom_out") engine.zoomBy(-0.25 * amount);
    else if (action === "rotate") engine.rotateBy(0.15 * amount, 0);
    else if (action === "pulse") engine.emitPulse(amount);
    else engine.reset();
  };

  const submit = useCallback(async (text: string) => {
    setDraft("");
    stopSpeaking();
    try {
      await sendMessage(text, {
        visual,
        onReply: async (reply) => {
          const settings = settingsStore.get();
          if (!settings.voice.enabled) return;
          setAiState("speaking", "Responding");
          await speak(reply, {
            voice: settings.voice.voice,
            speed: settings.voice.speed,
            volume: settings.voice.volume,
            onLevel: (level) => singuloStore.set({ speechLevel: level }),
          });
          singuloStore.set({ speechLevel: 0 });
          setAiState("idle", "Standby");
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    }
  }, []);

  const stopMic = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (levelTimer.current) clearInterval(levelTimer.current);
    levelTimer.current = null;
    setRecording(false);
    singuloStore.set({ micLevel: 0 });
    if (!recorder) return;
    const peak = peakRef.current;
    peakRef.current = 0;
    const blob = await recorder.stop();
    if (peak < 0.045) {
      setAiState("idle", "Nothing heard");
      return;
    }
    setAiState("thinking", "Transcribing");
    try {
      const body = new FormData();
      body.append("file", blob, "speech.wav");
      const response = await fetch("/api/ai/transcribe", { method: "POST", body });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (!text) {
        setAiState("idle", "Nothing heard");
        return;
      }
      await submit(text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transcription failed");
    }
  }, [submit]);

  const startMic = useCallback(async () => {
    try {
      stopSpeaking();
      const recorder = await startRecording(settingsStore.get().voice.microphoneId);
      recorderRef.current = recorder;
      setRecording(true);
      setAiState("listening", "Listening");
      peakRef.current = 0;
      levelTimer.current = setInterval(() => {
        const level = recorder.level();
        peakRef.current = Math.max(peakRef.current, level);
        singuloStore.set({ micLevel: level });
      }, 60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microphone unavailable");
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (recorderRef.current) void stopMic();
    else void startMic();
  }, [startMic, stopMic]);

  const gestures = useGestures(() => engineRef.current, {
    wake: () => toggleMic(),
    mediaToggle: () => toggleMic(),
    cancel: () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      setRecording(false);
      setAiState("idle", "Standby");
    },
    scroll: (direction) => {
      transcriptRef.current?.scrollBy({
        top: direction === "UP" ? -120 : 120,
        behavior: "smooth",
      });
    },
  });

  useEffect(
    () => () => {
      if (levelTimer.current) clearInterval(levelTimer.current);
      recorderRef.current?.cancel();
    },
    [],
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <SinguloCore onReady={(engine) => (engineRef.current = engine)} />

      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col justify-between p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            aria-label={chromeOpen ? "Hide interface controls" : "Show interface controls"}
            aria-expanded={chromeOpen}
            aria-controls="singulo-chrome"
            title={chromeOpen ? "Hide interface controls" : "Show interface controls"}
            onClick={() => setChromeOpen((open) => !open)}
            className="pointer-events-auto group -m-1 flex min-h-11 min-w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full border transition-all duration-150 group-hover:scale-150 group-active:scale-90 group-focus-visible:scale-150 ${
                chromeOpen
                  ? "border-primary bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                  : "border-border/70 bg-foreground/25 group-hover:border-primary group-hover:bg-primary/80"
              }`}
            />
            <span className="sr-only">
              {chromeOpen ? "Interface controls visible" : "Interface controls hidden"}
            </span>
          </button>
          {chromeOpen ? (
            <div className="animate-hud-in flex flex-wrap items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">
                {aiState} · {statusLine}
              </p>
              {cameraActive ? (
                <span className="flex items-center gap-1 rounded-full border border-primary/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Camera
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void gestures.toggle()}
                className="pointer-events-auto rounded-full border border-border/70 bg-card/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] backdrop-blur transition-colors hover:bg-card/80"
              >
                {gestures.active ? `Gestures · ${gestureMode}` : "Enable gestures"}
              </button>
              <button
                type="button"
                onClick={() =>
                  singuloStore.set({ panel: panel === "settings" ? "none" : "settings" })
                }
                className="pointer-events-auto rounded-full border border-border/70 bg-card/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] backdrop-blur transition-colors hover:bg-card/80"
              >
                Control
              </button>
            </div>
          ) : null}
        </header>

        {chromeOpen && (gestures.status || lastGesture) ? (
          <p className="label-hud absolute left-4 top-20 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:left-6">
            {gestures.status ?? `${lastGesture} · ${gestureSpeed}`}
          </p>
        ) : null}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="glow-core text-2xl font-semibold tracking-[0.55em] text-foreground sm:text-4xl">
            SINGULO
          </p>
          <p className="label-hud mt-2 text-[10px] tracking-[0.6em] text-primary sm:text-xs">
            soham
          </p>
        </div>


        {panel === "settings" ? (
          <SettingsPanel onClose={() => singuloStore.set({ panel: "none" })} />
        ) : null}

        {pending ? (
          <div className="pointer-events-auto mx-auto w-full max-w-md rounded-xl border border-border/60 bg-card/80 p-4 text-sm backdrop-blur">
            <p className="mb-3 text-muted-foreground">{pending.summary}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => pending.resolve(true)}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => pending.resolve(false)}
                className="flex-1 rounded-lg border border-border/60 px-3 py-2 text-xs uppercase tracking-[0.2em]"
              >
                Deny
              </button>
            </div>
          </div>
        ) : null}

        <section className="mx-auto w-full max-w-2xl space-y-3">
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          <div ref={transcriptRef} className="max-h-56 space-y-2 overflow-y-auto text-sm">
            {session.slice(-8).map((message) => (
              <p key={message.id} className="text-muted-foreground">
                <span className="mr-2 text-xs uppercase tracking-widest">{message.role}</span>
                {message.content}
              </p>
            ))}
          </div>
          <form
            className="pointer-events-auto flex gap-2 rounded-xl border border-border/60 bg-card/40 p-2 backdrop-blur"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) void submit(draft);
            }}
          >
            <button
              type="button"
              onClick={toggleMic}
              aria-label={recording ? "Stop listening" : "Start listening"}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                recording
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {recording ? "◉ Listening" : "◎ Mic"}
            </button>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Speak or type a command…"
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
