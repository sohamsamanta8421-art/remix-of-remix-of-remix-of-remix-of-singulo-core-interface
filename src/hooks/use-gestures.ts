import { useCallback, useEffect, useRef, useState } from "react";
import { GestureEngine } from "@/gestures/engine";
import { createGestureRouter } from "@/gestures/commands";
import type { SinguloContext } from "@/gestures/commands";
import { settingsStore, updateSettings } from "@/config/settings";
import { singuloStore } from "@/lib/state/singulo";
import { stopSpeaking } from "@/lib/voice/tts";
import type { SinguloCoreEngine } from "@/visual/core-engine";

export interface GestureHostActions {
  /** Confirm the pending permission / action. */
  confirm?: () => void;
  cancel?: () => void;
  wake?: () => void;
  mediaToggle?: () => void;
  mediaSeek?: (direction: "LEFT" | "RIGHT") => void;
  scroll?: (direction: "UP" | "DOWN") => void;
}

/**
 * Bridges the on-device gesture engine to the visual core and the app shell
 * through the mode-aware command router. Nothing else touches Three.js.
 */
export function useGestures(
  getCore: () => SinguloCoreEngine | null,
  actions: GestureHostActions = {},
) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const panelToggle = (panel: "settings" | "memory" | "conversation") =>
      singuloStore.set({ panel: singuloStore.get().panel === panel ? "none" : panel });

    const router = createGestureRouter(
      {
        zoom: (delta) => getCore()?.zoomBy(delta),
        setZoomFromPinch: (n) => getCore()?.setZoom(n),
        rotate: (dx, dy) => getCore()?.rotateBy(dx, dy),
        pan: (dx, dy) => getCore()?.panBy(dx, dy),
        reset: () => getCore()?.reset(),
        pulse: (strength) => getCore()?.emitPulse(strength),
        calm: (on) => getCore()?.setCalm(on),
        pointer: (position) => getCore()?.setPointer(position),
        select: () => getCore()?.emitPulse(1),
        doubleSelect: () => {
          getCore()?.emitPulse(1.4);
          panelToggle("settings");
        },
        grab: (on) => getCore()?.setGrabbed(on),
        swipeField: (direction) => getCore()?.pushField(direction),
        navigate: (direction) => {
          if (direction === "LEFT" || direction === "RIGHT") {
            actionsRef.current.mediaSeek?.(direction);
          }
        },
        scroll: (direction) => actionsRef.current.scroll?.(direction),
        interruptSpeech: () => stopSpeaking(),
        secondaryMode: () => panelToggle("settings"),
        confirm: () => {
          getCore()?.emitPulse(1);
          const pending = singuloStore.get().pending;
          if (pending) pending.resolve(true);
          else actionsRef.current.confirm?.();
        },
        cancel: () => {
          const pending = singuloStore.get().pending;
          if (pending) pending.resolve(false);
          else {
            stopSpeaking();
            actionsRef.current.cancel?.();
          }
        },
        quickControls: () => panelToggle("settings"),
        dial: (delta) => {
          const voice = settingsStore.get().voice;
          const volume = Math.max(0, Math.min(1, voice.volume + delta * 1.5));
          updateSettings("voice", { volume });
        },
        expand: (on) => {
          getCore()?.zoomBy(on ? 0.35 : -0.35);
          if (on && typeof document !== "undefined" && !document.fullscreenElement) {
            void document.documentElement.requestFullscreen?.().catch(() => {});
          } else if (!on && typeof document !== "undefined" && document.fullscreenElement) {
            void document.exitFullscreen?.().catch(() => {});
          }
        },
        resizePanel: (delta) => getCore()?.panBy(delta, 0),
        wake: () => {
          stopSpeaking();
          actionsRef.current.wake?.();
        },
        openMain: () => singuloStore.set({ panel: "none" }),
        emergencyPause: () => {
          stopSpeaking();
          getCore()?.setCalm(true);
          singuloStore.set({ statusLine: "Interaction paused" });
        },
        mediaToggle: () => actionsRef.current.mediaToggle?.(),
        mediaSeek: (direction) => actionsRef.current.mediaSeek?.(direction),
        zoneFocus: () => {},
        setMode: (mode) => updateSettings("gesture", { mode }),
      },
      {
        getContext: (): SinguloContext =>
          singuloStore.get().panel === "none" ? "visual" : "menu",
        getMode: () => settingsStore.get().gesture.mode,
        autoMode: () => settingsStore.get().gesture.autoMode,
        isSpeaking: () => singuloStore.get().aiState === "speaking",
        palmInterrupts: () => settingsStore.get().gesture.palmInterrupts,
        depthSensitivity: () => settingsStore.get().gesture.depthSensitivity,
        sensitivity: () => {
          const g = settingsStore.get().gesture;
          return { zoom: g.zoomSensitivity, rotation: g.rotationSensitivity };
        },
      },
    );

    const unsubscribe = GestureEngine.subscribe((event) => {
      router(event);
      singuloStore.set({
        lastGesture: `${event.gesture}${event.variant ? ` · ${event.variant}` : ""} · ${event.phase}`,
      });
    });
    return () => {
      unsubscribe();
    };
  }, [getCore]);

  // keep engine settings live
  useEffect(() => {
    const unsubscribe = settingsStore.subscribe(() => {
      if (GestureEngine.isRunning()) GestureEngine.applySettings(settingsStore.get().gesture);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => () => GestureEngine.stop(), []);

  const toggle = useCallback(async () => {
    if (GestureEngine.isRunning()) {
      GestureEngine.stop();
      setActive(false);
      setStatus(null);
      singuloStore.set({ cameraActive: false, gestureReady: false, lastGesture: null });
      updateSettings("gesture", { enabled: false });
      getCore()?.setPointer(null);
      return;
    }
    setStatus("Starting camera…");
    try {
      await GestureEngine.start(settingsStore.get().gesture);
      setActive(true);
      setStatus(null);
      singuloStore.set({ cameraActive: true, gestureReady: true });
      updateSettings("gesture", { enabled: true });
    } catch (cause) {
      setActive(false);
      setStatus(cause instanceof Error ? cause.message : "Camera unavailable");
      singuloStore.set({ cameraActive: false, gestureReady: false });
    }
  }, [getCore]);

  return { active, status, toggle };
}
