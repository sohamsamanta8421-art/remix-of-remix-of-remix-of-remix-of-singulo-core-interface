import { useEffect, useState } from "react";
import {
  AI_MODELS,
  GESTURE_LABELS,
  TTS_VOICES,
  resetSettings,
  updateSettings,
  useSettings,
} from "@/config/settings";
import { listCameras } from "@/gestures/engine";
import { speak, stopSpeaking } from "@/lib/voice/tts";
import { clearNotes, clearPersistentMemory, clearSession, useMemory } from "@/lib/memory/store";
import { singuloStore, useSingulo } from "@/lib/state/singulo";
import type { GestureMode, GestureName, GestureSpeed, Sensitivity } from "@/types/singulo";

const TABS = ["AI", "Voice", "Gesture", "Appearance", "Privacy"] as const;
type Tab = (typeof TABS)[number];

const MODES: { id: GestureMode; label: string; hint: string }[] = [
  { id: "navigation", label: "Navigation", hint: "Point cursor · pinch click · swipe navigate" },
  { id: "spatial", label: "3D", hint: "Pinch grab · two-hand zoom & rotate" },
  { id: "window", label: "Window", hint: "Fist move · pinch resize · palm shift" },
  { id: "media", label: "Media", hint: "Two fingers play/pause · swipe track · thumb confirm" },
];

const THEMES: { id: "ember" | "blue"; label: string }[] = [
  { id: "ember", label: "Ember" },
  { id: "blue", label: "Blue" },
];

const SPEEDS: { id: GestureSpeed; label: string }[] = [
  { id: "instant", label: "Instant" },
  { id: "fast", label: "Fast" },
  { id: "balanced", label: "Balanced" },
  { id: "safe", label: "Safe" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">{children}</span>
    </label>
  );
}

const selectClass =
  "rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs text-foreground outline-none";

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-36 accent-primary"
      />
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {value.toFixed(2)}
      </span>
    </>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useSettings((s) => s);
  const memory = useMemory((s) => s);
  const cameraActive = useSingulo((s) => s.cameraActive);
  const [tab, setTab] = useState<Tab>("Voice");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-blue", settings.appearance.theme === "blue");
  }, [settings.appearance.theme]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    void listCameras().then(setCameras).catch(() => setCameras([]));
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      void navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => setMics(devices.filter((d) => d.kind === "audioinput")))
        .catch(() => setMics([]));
    }
  }, []);

  const testVoice = async () => {
    setTestError(null);
    setTesting(true);
    stopSpeaking();
    try {
      await speak("SINGULO voice channel online. Systems nominal.", {
        voice: settings.voice.voice,
        speed: settings.voice.speed,
        volume: settings.voice.volume,
        onLevel: (level) => singuloStore.set({ speechLevel: level }),
      });
    } catch (cause) {
      setTestError(cause instanceof Error ? cause.message : "Voice test failed");
    } finally {
      singuloStore.set({ speechLevel: 0 });
      setTesting(false);
    }
  };

  return (
    <aside className="pointer-events-auto absolute right-4 top-16 z-30 flex max-h-[80vh] w-[min(94vw,26rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h2 className="text-xs uppercase tracking-[0.3em]">Control</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </header>

      <nav className="flex gap-1 border-b border-border/40 px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] transition-colors ${
              tab === t ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === "AI" ? (
          <div>
            <Row label="Model">
              <select
                className={selectClass}
                value={settings.ai.model}
                onChange={(event) => updateSettings("ai", { model: event.target.value })}
              >
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Temperature">
              <Slider
                value={settings.ai.temperature}
                min={0}
                max={1}
                step={0.05}
                onChange={(temperature) => updateSettings("ai", { temperature })}
              />
            </Row>
            <Row label="Response style">
              <select
                className={selectClass}
                value={settings.ai.style}
                onChange={(event) =>
                  updateSettings("ai", { style: event.target.value as typeof settings.ai.style })
                }
              >
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </Row>
          </div>
        ) : null}

        {tab === "Voice" ? (
          <div>
            <Row label="Spoken replies">
              <input
                type="checkbox"
                checked={settings.voice.enabled}
                onChange={(event) => updateSettings("voice", { enabled: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
            </Row>
            <Row label="Speaker voice">
              <select
                className={selectClass}
                value={settings.voice.voice}
                onChange={(event) => updateSettings("voice", { voice: event.target.value })}
              >
                {TTS_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Speech speed">
              <Slider
                value={settings.voice.speed}
                min={0.5}
                max={2}
                step={0.05}
                onChange={(speed) => updateSettings("voice", { speed })}
              />
            </Row>
            <Row label="Volume">
              <Slider
                value={settings.voice.volume}
                min={0}
                max={1}
                step={0.05}
                onChange={(volume) => updateSettings("voice", { volume })}
              />
            </Row>
            <Row label="Microphone">
              <select
                className={selectClass}
                value={settings.voice.microphoneId ?? ""}
                onChange={(event) =>
                  updateSettings("voice", { microphoneId: event.target.value || null })
                }
              >
                <option value="">System default</option>
                {mics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || "Microphone"}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Auto-listen after reply">
              <input
                type="checkbox"
                checked={settings.voice.autoListen}
                onChange={(event) => updateSettings("voice", { autoListen: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
            </Row>
            <button
              type="button"
              onClick={() => void testVoice()}
              disabled={testing}
              className="mt-2 w-full rounded-lg border border-border/60 py-2 text-xs uppercase tracking-[0.2em] hover:bg-card disabled:opacity-50"
            >
              {testing ? "Speaking…" : "Test voice"}
            </button>
            {testError ? <p className="mt-2 text-xs text-destructive">{testError}</p> : null}
            {mics.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Device names appear after you grant microphone permission once.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "Gesture" ? (
          <div>
            <Row label="Camera">
              <select
                className={selectClass}
                value={settings.gesture.cameraId ?? ""}
                onChange={(event) =>
                  updateSettings("gesture", { cameraId: event.target.value || null })
                }
              >
                <option value="">Default camera</option>
                {cameras.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || "Camera"}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Hands tracked">
              <select
                className={selectClass}
                value={settings.gesture.hands}
                onChange={(event) =>
                  updateSettings("gesture", { hands: Number(event.target.value) as 1 | 2 })
                }
              >
                <option value={1}>One hand</option>
                <option value={2}>Two hands (advanced)</option>
              </select>
            </Row>
            <div className="py-2">
              <p className="mb-1 text-xs text-muted-foreground">Mode</p>
              <div className="grid grid-cols-2 gap-1">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.hint}
                    onClick={() => updateSettings("gesture", { mode: m.id })}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                      settings.gesture.mode === m.id
                        ? "border-primary/60 bg-primary/15"
                        : "border-border/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {MODES.find((m) => m.id === settings.gesture.mode)?.hint}
              </p>
            </div>
            <div className="py-2">
              <p className="mb-1 text-xs text-muted-foreground">Reaction speed</p>
              <div className="grid grid-cols-4 gap-1">
                {SPEEDS.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => updateSettings("gesture", { speed: sp.id })}
                    className={`rounded-lg border px-1 py-1.5 text-[10px] uppercase tracking-wide transition-colors ${
                      settings.gesture.speed === sp.id
                        ? "border-primary/60 bg-primary/15"
                        : "border-border/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>
            <Row label="Sensitivity">
              <select
                className={selectClass}
                value={settings.gesture.sensitivity}
                onChange={(event) =>
                  updateSettings("gesture", { sensitivity: event.target.value as Sensitivity })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Row>
            <Row label="Smoothing">
              <select
                className={selectClass}
                value={settings.gesture.smoothing}
                onChange={(event) =>
                  updateSettings("gesture", { smoothing: event.target.value as Sensitivity })
                }
              >
                <option value="low">Low (fastest)</option>
                <option value="medium">Medium</option>
                <option value="high">High (steadiest)</option>
              </select>
            </Row>
            <Row label="Confidence gate">
              <Slider
                value={settings.gesture.confidence}
                min={0.3}
                max={0.95}
                step={0.01}
                onChange={(confidence) => updateSettings("gesture", { confidence })}
              />
            </Row>
            <Row label="Hold duration (s)">
              <Slider
                value={settings.gesture.holdMs / 1000}
                min={0.2}
                max={2}
                step={0.05}
                onChange={(v) => updateSettings("gesture", { holdMs: Math.round(v * 1000) })}
              />
            </Row>
            <Row label="Zoom sensitivity">
              <Slider
                value={settings.gesture.zoomSensitivity}
                min={0.2}
                max={3}
                step={0.1}
                onChange={(zoomSensitivity) => updateSettings("gesture", { zoomSensitivity })}
              />
            </Row>
            <Row label="Rotation sensitivity">
              <Slider
                value={settings.gesture.rotationSensitivity}
                min={0.2}
                max={3}
                step={0.1}
                onChange={(rotationSensitivity) =>
                  updateSettings("gesture", { rotationSensitivity })
                }
              />
            </Row>
            <Row label="Swipe sensitivity">
              <Slider
                value={settings.gesture.swipeSensitivity}
                min={0.2}
                max={3}
                step={0.1}
                onChange={(swipeSensitivity) => updateSettings("gesture", { swipeSensitivity })}
              />
            </Row>
            <Row label="Dominant hand">
              <select
                className={selectClass}
                value={settings.gesture.dominantHand}
                onChange={(event) =>
                  updateSettings("gesture", {
                    dominantHand: event.target.value as "Left" | "Right",
                  })
                }
              >
                <option value="Right">Right</option>
                <option value="Left">Left</option>
              </select>
            </Row>
            <Row label="Distance-adaptive control">
              <input
                type="checkbox"
                checked={settings.gesture.depthSensitivity}
                onChange={(event) =>
                  updateSettings("gesture", { depthSensitivity: event.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
            </Row>
            <Row label="Auto mode switching">
              <input
                type="checkbox"
                checked={settings.gesture.autoMode}
                onChange={(event) => updateSettings("gesture", { autoMode: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
            </Row>
            <Row label="Open palm interrupts speech">
              <input
                type="checkbox"
                checked={settings.gesture.palmInterrupts}
                onChange={(event) =>
                  updateSettings("gesture", { palmInterrupts: event.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
            </Row>

            <p className="mb-1 mt-3 text-xs text-muted-foreground">Enabled gestures</p>
            <div className="space-y-1">
              {(Object.keys(GESTURE_LABELS) as GestureName[]).map((name) => (
                <label key={name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">{GESTURE_LABELS[name]}</span>
                  <input
                    type="checkbox"
                    checked={settings.gesture.enabledGestures[name]}
                    onChange={(event) =>
                      updateSettings("gesture", {
                        enabledGestures: {
                          ...settings.gesture.enabledGestures,
                          [name]: event.target.checked,
                        },
                      })
                    }
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Camera {cameraActive ? "active — indicator shown in header" : "off"}.
            </p>
          </div>
        ) : null}

        {tab === "Appearance" ? (
          <div>
            <Row label="Theme">
              <span className="flex gap-1">
                {THEMES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateSettings("appearance", { theme: option.id })}
                    className={`rounded-md border px-2 py-1 text-xs uppercase tracking-[0.15em] transition-colors ${
                      settings.appearance.theme === option.id
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
            </Row>
            <Row label="Interface intensity">
              <Slider
                value={settings.appearance.intensity}
                min={0.2}
                max={2}
                step={0.05}
                onChange={(intensity) => updateSettings("appearance", { intensity })}
              />
            </Row>
            <Row label="Particle density">
              <Slider
                value={settings.appearance.particleDensity}
                min={0.2}
                max={2}
                step={0.05}
                onChange={(particleDensity) => updateSettings("appearance", { particleDensity })}
              />
            </Row>
            <Row label="Animation intensity">
              <Slider
                value={settings.appearance.animationIntensity}
                min={0}
                max={2}
                step={0.05}
                onChange={(animationIntensity) =>
                  updateSettings("appearance", { animationIntensity })
                }
              />
            </Row>
            <Row label="Reduced motion">
              <input
                type="checkbox"
                checked={settings.appearance.reducedMotion}
                onChange={(event) =>
                  updateSettings("appearance", { reducedMotion: event.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
            </Row>
          </div>
        ) : null}

        {tab === "Privacy" ? (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Camera: {cameraActive ? "active" : "off"} · Microphone: used only while recording ·
              Video frames never leave this device.
            </p>
            <p className="text-xs text-muted-foreground">
              Saved memories: {memory.persistent.length} · Notes: {memory.notes.length} · Session
              messages: {memory.session.length}
            </p>
            <div className="grid gap-2 pt-1">
              <button
                type="button"
                onClick={() => clearSession()}
                className="rounded-lg border border-border/60 py-2 text-xs uppercase tracking-[0.2em] hover:bg-card"
              >
                Clear session
              </button>
              <button
                type="button"
                onClick={() => clearPersistentMemory()}
                className="rounded-lg border border-border/60 py-2 text-xs uppercase tracking-[0.2em] hover:bg-card"
              >
                Delete saved memory
              </button>
              <button
                type="button"
                onClick={() => clearNotes()}
                className="rounded-lg border border-border/60 py-2 text-xs uppercase tracking-[0.2em] hover:bg-card"
              >
                Delete notes
              </button>
              <button
                type="button"
                onClick={() => resetSettings()}
                className="rounded-lg border border-destructive/50 py-2 text-xs uppercase tracking-[0.2em] text-destructive hover:bg-destructive/10"
              >
                Reset all settings
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
