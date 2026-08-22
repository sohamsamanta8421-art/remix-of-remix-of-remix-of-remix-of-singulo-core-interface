import type { GestureEvent, GestureMode } from "@/types/singulo";

export type SinguloContext = "visual" | "menu" | "conversation";

export interface CommandTargets {
  zoom: (delta: number) => void;
  setZoomFromPinch: (normalised: number) => void;
  rotate: (dx: number, dy: number) => void;
  pan: (dx: number, dy: number) => void;
  reset: () => void;
  pulse: (strength: number) => void;
  calm: (on: boolean) => void;
  pointer: (position: { x: number; y: number } | null) => void;
  select: (position: { x: number; y: number }) => void;
  doubleSelect: (position: { x: number; y: number }) => void;
  grab: (active: boolean, position: { x: number; y: number }) => void;
  swipeField: (direction: "LEFT" | "RIGHT" | "UP" | "DOWN") => void;
  navigate: (direction: "LEFT" | "RIGHT" | "UP" | "DOWN") => void;
  scroll: (direction: "UP" | "DOWN") => void;
  interruptSpeech: () => void;
  secondaryMode: () => void;
  confirm: () => void;
  cancel: () => void;
  quickControls: () => void;
  dial: (delta: number) => void;
  expand: (on: boolean) => void;
  resizePanel: (delta: number) => void;
  wake: () => void;
  openMain: () => void;
  emergencyPause: () => void;
  mediaToggle: () => void;
  mediaSeek: (direction: "LEFT" | "RIGHT") => void;
  zoneFocus: (zone: "left" | "center" | "right") => void;
  setMode: (mode: GestureMode) => void;
}

export interface RouterOptions {
  getContext: () => SinguloContext;
  getMode: () => GestureMode;
  isSpeaking: () => boolean;
  palmInterrupts: () => boolean;
  depthSensitivity: () => boolean;
  sensitivity: () => { zoom: number; rotation: number };
}

/**
 * Context- and mode-aware command router. Gestures never touch Three.js
 * directly; every event is mapped to a high-level SINGULO command. Modes keep
 * conflicting gestures apart (navigation / spatial / window / media).
 */
export function createGestureRouter(targets: CommandTargets, options: RouterOptions) {
  let grabbing = false;
  let pinchActive = false;
  let lastZone: "left" | "center" | "right" | null = null;

  return function route(event: GestureEvent) {
    const context = options.getContext();
    const mode = options.getMode();
    const { zoom: zoomSensitivity, rotation: rotationSensitivity } = options.sensitivity();
    // Hand closer to the camera → finer, stronger control.
    const depthGain = options.depthSensitivity() ? 0.6 + (event.depth ?? 0.5) * 1.2 : 1;

    if (event.zone && event.zone !== lastZone) {
      lastZone = event.zone;
      targets.zoneFocus(event.zone);
    }

    switch (event.gesture) {
      // ---- two-hand ------------------------------------------------------
      case "TWO_HAND_ZOOM":
        targets.zoom(event.delta.x * 9 * zoomSensitivity);
        return;
      case "TWO_HAND_ROTATE":
        targets.rotate(event.delta.x * 2.2 * rotationSensitivity, 0);
        return;
      case "TWO_PALMS":
        if (event.variant === "EXPAND") targets.expand(true);
        else if (event.variant === "COLLAPSE") targets.expand(false);
        else if (event.variant === "RESIZE") targets.resizePanel(event.delta.x);
        else if (event.variant === "PAUSE") targets.emergencyPause();
        return;
      case "CLAP":
        targets.wake();
        targets.pulse(1);
        return;
      case "BOTH_RAISED":
        targets.openMain();
        return;

      // ---- single hand ---------------------------------------------------
      case "PINCH": {
        if (event.phase === "RELEASED" || event.phase === "COOLDOWN") {
          pinchActive = false;
          targets.pointer(null);
          return;
        }
        if (event.variant === "DOUBLE") {
          targets.doubleSelect(event.position);
          return;
        }
        if (mode === "spatial") {
          targets.setZoomFromPinch(event.value);
          targets.rotate(
            event.delta.x * 2.6 * rotationSensitivity * depthGain,
            event.delta.y * 2.6 * rotationSensitivity * depthGain,
          );
        } else if (mode === "window") {
          // pinch + drag resizes, vertical pinch drag adjusts value
          targets.resizePanel(event.delta.x * depthGain);
          targets.dial(-event.delta.y * depthGain);
        } else {
          // navigation: pinch = click, pinch + hold = drag
          targets.pointer(event.position);
          if (event.phase === "CONFIRMED" && !pinchActive && context !== "conversation") {
            targets.select(event.position);
          }
          if (event.variant === "HOLD" || (event.heldMs ?? 0) > 220) {
            targets.grab(true, event.position);
            targets.pan(event.delta.x * depthGain, event.delta.y * depthGain);
            grabbing = true;
          }
          // pinch + vertical drag → value, pinch + horizontal → timeline
          if (Math.abs(event.delta.y) > Math.abs(event.delta.x)) {
            targets.dial(-event.delta.y * depthGain);
          }
        }
        pinchActive = true;
        return;
      }
      case "POINT": {
        targets.pointer(event.phase === "RELEASED" ? null : event.position);
        if (grabbing) {
          grabbing = false;
          targets.grab(false, event.position);
        }
        return;
      }
      case "CIRCLE": {
        if (mode === "media" || mode === "window") targets.dial(event.value * 0.25);
        else targets.rotate(event.value * 0.35 * rotationSensitivity, 0);
        return;
      }
      case "FIST": {
        const active = event.phase === "CONFIRMED" || event.phase === "ACTIVE";
        if (active !== grabbing) {
          grabbing = active;
          targets.grab(active, event.position);
          if (active) targets.pulse(0.8);
        }
        if (active) targets.pan(event.delta.x * depthGain, event.delta.y * depthGain);
        return;
      }
      case "OPEN_PALM": {
        if (event.phase === "CONFIRMED") {
          targets.calm(true);
          if (options.palmInterrupts() && options.isSpeaking()) targets.interruptSpeech();
        }
        if (mode === "window" && (event.phase === "ACTIVE" || event.phase === "CONFIRMED")) {
          if (Math.abs(event.delta.x) > 0.01) {
            targets.navigate(event.delta.x > 0 ? "RIGHT" : "LEFT");
          }
        }
        if (event.phase === "RELEASED") targets.calm(false);
        return;
      }
      case "VICTORY": {
        if (event.phase !== "CONFIRMED") return;
        if (mode === "media") targets.mediaToggle();
        else {
          targets.secondaryMode();
        }
        return;
      }
      case "THREE_FINGERS": {
        if (event.phase === "CONFIRMED") targets.quickControls();
        return;
      }
      case "THUMB_UP": {
        if (event.phase === "CONFIRMED") targets.confirm();
        return;
      }
      case "THUMB_DOWN": {
        if (event.phase === "CONFIRMED") targets.cancel();
        return;
      }
      case "SWIPE": {
        if (!event.direction) return;
        targets.swipeField(event.direction);
        if (mode === "media" && (event.direction === "LEFT" || event.direction === "RIGHT")) {
          targets.mediaSeek(event.direction);
          return;
        }
        if (event.direction === "UP" || event.direction === "DOWN") {
          targets.scroll(event.direction);
          return;
        }
        targets.navigate(event.direction);
        return;
      }
    }
  };
}
