import type { GestureName, GestureSpeed, Settings } from "@/types/singulo";
import { createStore } from "@/lib/tiny-store";

const STORAGE_KEY = "singulo.settings.v1";

export const AI_MODELS = [
  { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash — fast (default)" },
  { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash — newer reasoning" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro — deliberate" },
  { id: "openai/gpt-5.4", label: "GPT-5.4 — general purpose" },
] as const;

export const TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

const allGestures: GestureName[] = [
  "OPEN_PALM",
  "FIST",
  "POINT",
  "PINCH",
  "VICTORY",
  "SWIPE",
  "THUMB_UP",
  "THUMB_DOWN",
  "THREE_FINGERS",
  "CIRCLE",
  "CLAP",
  "TWO_HAND_ZOOM",
  "TWO_HAND_ROTATE",
  "TWO_PALMS",
  "BOTH_RAISED",
];

export const GESTURE_LABELS: Record<GestureName, string> = {
  POINT: "Point — cursor",
  PINCH: "Pinch — click / drag",
  FIST: "Fist — grab",
  OPEN_PALM: "Open palm — pause",
  VICTORY: "Two fingers — secondary / play-pause",
  SWIPE: "Swipe — navigate & scroll",
  THUMB_UP: "Thumb up — confirm",
  THUMB_DOWN: "Thumb down — cancel",
  THREE_FINGERS: "Three fingers — quick controls",
  CIRCLE: "Finger circle — rotate / dial",
  CLAP: "Clap — wake assistant",
  TWO_HAND_ZOOM: "Two-hand pinch — zoom",
  TWO_HAND_ROTATE: "Two-hand twist — rotate 3D",
  TWO_PALMS: "Both palms — expand / collapse / resize",
  BOTH_RAISED: "Both hands raised — main interface",
};

/** Latency presets. `instant` fires on the first confident frame. */
export const speedProfiles: Record<
  GestureSpeed,
  { confirmFrames: number; cooldownMs: number; swipeCooldownMs: number; minCutoff: number }
> = {
  instant: { confirmFrames: 1, cooldownMs: 70, swipeCooldownMs: 140, minCutoff: 3.2 },
  fast: { confirmFrames: 1, cooldownMs: 110, swipeCooldownMs: 220, minCutoff: 2.4 },
  balanced: { confirmFrames: 2, cooldownMs: 200, swipeCooldownMs: 420, minCutoff: 1.6 },
  safe: { confirmFrames: 3, cooldownMs: 320, swipeCooldownMs: 700, minCutoff: 1.2 },
};

export const defaultSettings: Settings = {
  ai: { model: AI_MODELS[0].id, temperature: 0.6, style: "balanced" },
  voice: {
    enabled: true,
    voice: "alloy",
    speed: 1,
    volume: 1,
    microphoneId: null,
    autoListen: false,
  },
  gesture: {
    enabled: false,
    cameraId: null,
    hands: 2,
    mode: "navigation",
    speed: "instant",
    
    holdMs: 700,
    depthSensitivity: true,
    sensitivity: "high",
    smoothing: "low",
    confidence: 0.62,
    zoomSensitivity: 1,
    rotationSensitivity: 1,
    swipeSensitivity: 1,
    dominantHand: "Right",
    pinchMin: 0.03,
    pinchMax: 0.28,
    palmInterrupts: true,
    debug: false,
    enabledGestures: Object.fromEntries(allGestures.map((g) => [g, true])) as Record<
      GestureName,
      boolean
    >,
  },
  appearance: {
    theme: "ember",
    intensity: 1,
    particleDensity: 1,
    animationIntensity: 1,
    reducedMotion: false,
    perfOverlay: false,
  },
};

function load(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ai: { ...defaultSettings.ai, ...parsed.ai },
      voice: { ...defaultSettings.voice, ...parsed.voice },
      gesture: {
        ...defaultSettings.gesture,
        ...parsed.gesture,
        enabledGestures: {
          ...defaultSettings.gesture.enabledGestures,
          ...parsed.gesture?.enabledGestures,
        },
      },
      appearance: { ...defaultSettings.appearance, ...parsed.appearance },
    };
  } catch {
    return defaultSettings;
  }
}

export const settingsStore = createStore<Settings>(defaultSettings);

export function hydrateSettings() {
  settingsStore.set(load());
}

type Section = keyof Settings;

export function updateSettings<S extends Section>(section: S, patch: Partial<Settings[S]>) {
  const current = settingsStore.get();
  const next = { ...current, [section]: { ...current[section], ...patch } } as Settings;
  settingsStore.set(next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked — settings stay in-memory for this session */
    }
  }
}

export function resetSettings() {
  settingsStore.set(defaultSettings);
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export const useSettings = settingsStore.useStore;

export const sensitivityScale: Record<Settings["gesture"]["sensitivity"], number> = {
  low: 0.6,
  medium: 1,
  high: 1.6,
};

export const smoothingAlpha: Record<Settings["gesture"]["smoothing"], number> = {
  low: 0.7,
  medium: 0.45,
  high: 0.22,
};