export type AiState = "idle" | "listening" | "thinking" | "speaking" | "executing" | "error";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  createdAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  ok: boolean;
  output: string;
}

export interface MemoryEntry {
  id: string;
  text: string;
  createdAt: number;
  source: "user" | "assistant";
}

export interface NoteEntry {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export type Sensitivity = "low" | "medium" | "high";

export interface Settings {
  ai: {
    model: string;
    temperature: number;
    style: "concise" | "balanced" | "detailed";
  };
  voice: {
    enabled: boolean;
    voice: string;
    speed: number;
    volume: number;
    microphoneId: string | null;
    autoListen: boolean;
  };
  gesture: {
    enabled: boolean;
    cameraId: string | null;
    hands: 1 | 2;
    mode: GestureMode;
    speed: GestureSpeed;
    
    holdMs: number;
    depthSensitivity: boolean;
    sensitivity: Sensitivity;
    smoothing: Sensitivity;
    confidence: number;
    zoomSensitivity: number;
    rotationSensitivity: number;
    swipeSensitivity: number;
    dominantHand: "Left" | "Right";
    pinchMin: number;
    pinchMax: number;
    palmInterrupts: boolean;
    debug: boolean;
    enabledGestures: Record<GestureName, boolean>;
  };
  appearance: {
    theme: "ember" | "blue";
    intensity: number;
    particleDensity: number;
    animationIntensity: number;
    reducedMotion: boolean;
  };
}

export type GestureName =
  | "OPEN_PALM"
  | "FIST"
  | "POINT"
  | "PINCH"
  | "VICTORY"
  | "SWIPE"
  | "THUMB_UP"
  | "THUMB_DOWN"
  | "THREE_FINGERS"
  | "CIRCLE"
  | "CLAP"
  | "TWO_HAND_ZOOM"
  | "TWO_HAND_ROTATE"
  | "TWO_PALMS"
  | "BOTH_RAISED";

/** Only these gestures need two hands in frame. */
export const TWO_HAND_GESTURES: GestureName[] = [
  "CLAP",
  "TWO_HAND_ZOOM",
  "TWO_HAND_ROTATE",
  "TWO_PALMS",
  "BOTH_RAISED",
];

export type GestureMode = "navigation" | "spatial" | "window" | "media";

export type GestureSpeed = "instant" | "fast" | "balanced" | "safe";

export type HandZone = "left" | "center" | "right";

export type GesturePhase = "IDLE" | "DETECTED" | "CONFIRMED" | "ACTIVE" | "RELEASED" | "COOLDOWN";

export interface GestureEvent {
  type: "gesture";
  gesture: GestureName;
  phase: GesturePhase;
  confidence: number;
  hand: "Left" | "Right";
  position: { x: number; y: number };
  delta: { x: number; y: number };
  value: number;
  direction?: "LEFT" | "RIGHT" | "UP" | "DOWN";
  twoHand?: boolean;
  /** Sub-kind for compound gestures, e.g. EXPAND / COLLAPSE / RESIZE / HOLD / DOUBLE. */
  variant?: string;
  /** Horizontal interaction zone of the hand, used for positional controls. */
  zone?: HandZone;
  /** 0..1 proximity to camera; drives adaptive sensitivity. */
  depth?: number;
  /** Milliseconds the gesture has been held. */
  heldMs?: number;
  timestamp: number;
}

export interface GestureFrame {
  hands: {
    hand: "Left" | "Right";
    landmarks: { x: number; y: number; z: number }[];
    pinchDistance: number;
    velocity: { x: number; y: number };
    gesture: GestureName | null;
    confidence: number;
    phase: GesturePhase;
  }[];
  fps: number;
  processingMs: number;
  twoHandDistance: number | null;
  timestamp: number;
}