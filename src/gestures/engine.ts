import type { GestureEvent, GestureFrame, GestureName, Settings } from "@/types/singulo";
import { LandmarkSmoother, Smoothed } from "./filters";
import { analysePose, recognise } from "./recognizers";
import { CircleDetector, GestureStateMachine, SwipeDetector } from "./state-machine";
import { sensitivityScale, smoothingAlpha, speedProfiles } from "@/config/settings";
import type { HandZone } from "@/types/singulo";

type Listener = (event: GestureEvent) => void;
type FrameListener = (frame: GestureFrame) => void;

interface Landmarker {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    landmarks: { x: number; y: number; z: number }[][];
    handedness?: { categoryName: string }[][];
    handednesses?: { categoryName: string }[][];
  };
  setOptions: (options: Record<string, unknown>) => Promise<void>;
  close: () => void;
}

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_CACHE = "singulo-gesture-models-v1";

let modelCached = false;
/** True once the hand model is stored in the Cache API (offline-capable). */
export function isModelCached() {
  return modelCached;
}

/** Fetch the model once and keep the bytes in the Cache API for offline use. */
async function loadModelBuffer(): Promise<ArrayBuffer | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(MODEL_CACHE);
    let hit = await cache.match(MODEL_URL);
    if (!hit) {
      const response = await fetch(MODEL_URL);
      if (!response.ok) return null;
      await cache.put(MODEL_URL, response.clone());
      hit = await cache.match(MODEL_URL);
    }
    if (!hit) return null;
    modelCached = true;
    return await hit.arrayBuffer();
  } catch {
    return null;
  }
}


/**
 * GestureEngine — camera → MediaPipe hand landmarks → smoothing → pose
 * analysis → recognition → state machine → command events.
 * Runs entirely on-device; frames never leave the browser.
 */
class GestureEngineImpl {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: Landmarker | null = null;
  private raf = 0;
  private running = false;
  private lastTimestamp = -1;
  private listeners = new Set<Listener>();
  private frameListeners = new Set<FrameListener>();
  private settings: Settings["gesture"] | null = null;

  private smoothers = new Map<string, LandmarkSmoother>();
  private machines = new Map<string, GestureStateMachine>();
  private swipes = new Map<string, SwipeDetector>();
  private pinch = new Map<string, Smoothed>();
  private lastPositions = new Map<string, { x: number; y: number; t: number }>();
  private circles = new Map<string, CircleDetector>();
  private lastPinchTap = new Map<string, number>();
  private holdFired = new Map<string, boolean>();
  private twoHandLast: { dist: number; angle: number; midX: number } | null = null;
  private lastTwoHandGesture = 0;
  private lastClap = 0;
  private lastBothRaised = 0;
  private frameTimes: number[] = [];
  private lastTwoHandDistance: number | null = null;
  /** Consecutive inference failures — used for graceful recovery. */
  private errorStreak = 0;

  /**
   * Drop transient per-hand tracking state (smoothers keep their identity but
   * velocity/hold/swipe history is cleared) so losing a hand never leaves the
   * recognisers in a stuck state.
   */
  private resetTracking() {
    if (!this.lastPositions.size && !this.twoHandLast) return;
    this.lastPositions.clear();
    this.holdFired.clear();
    this.circles.forEach((c) => c.reset?.());
    this.twoHandLast = null;
    this.lastTwoHandDistance = null;
  }

  isRunning() {
    return this.running;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeFrames(listener: FrameListener) {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  applySettings(gesture: Settings["gesture"]) {
    this.settings = gesture;
    const profile = speedProfiles[gesture.speed];
    const beta = 0.02 + (1 - smoothingAlpha[gesture.smoothing]) * 0.05;
    this.smoothers.forEach((s) => s.setBeta(beta, profile.minCutoff));
    this.machines.forEach((m) => {
      m.setThreshold(gesture.confidence);
      m.setTiming(profile.confirmFrames, profile.cooldownMs);
    });
    this.pinch.forEach((p) => p.setAlpha(smoothingAlpha[gesture.smoothing]));
    const scale = sensitivityScale[gesture.sensitivity] * gesture.swipeSensitivity;
    this.swipes.forEach((s) =>
      s.configure({
        minDisplacement: 0.13 / scale,
        minVelocity: 0.45 / scale,
        maxDurationMs: 300,
        cooldownMs: profile.swipeCooldownMs,
      }),
    );
    void this.landmarker?.setOptions({ numHands: gesture.hands }).catch(() => {});
  }

  async start(gesture: Settings["gesture"]): Promise<void> {
    if (this.running) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not expose camera access.");
    }
    this.settings = gesture;

    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
    // Start the camera and the model load in parallel — the camera is the slow part.
    const streamPromise = navigator.mediaDevices.getUserMedia({
      video: {
        ...(gesture.cameraId ? { deviceId: { exact: gesture.cameraId } } : { facingMode: "user" }),
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 60 },
      },
      audio: false,
    });

    const [fileset, buffer] = await Promise.all([
      FilesetResolver.forVisionTasks(WASM_BASE),
      loadModelBuffer(),
    ]);

    const baseOptions = buffer
      ? { modelAssetBuffer: new Uint8Array(buffer), delegate: "GPU" as const }
      : { modelAssetPath: MODEL_URL, delegate: "GPU" as const };

    const create = (delegate: "GPU" | "CPU") =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { ...baseOptions, delegate },
        runningMode: "VIDEO",
        numHands: gesture.hands,
        minHandDetectionConfidence: 0.35,
        minTrackingConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
      });

    try {
      this.landmarker = (await create("GPU")) as unknown as Landmarker;
    } catch {
      this.landmarker = (await create("CPU")) as unknown as Landmarker;
    }

    this.stream = await streamPromise;


    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.srcObject = this.stream;
    await video.play();
    this.video = video;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.landmarker?.close();
    this.landmarker = null;
    this.smoothers.clear();
    this.machines.clear();
    this.swipes.clear();
    this.pinch.clear();
    this.circles.clear();
    this.lastPositions.clear();
    this.lastPinchTap.clear();
    this.holdFired.clear();
    this.lastTwoHandDistance = null;
    this.twoHandLast = null;
  }

  /** The live video element, exposed only for debug preview rendering. */
  getVideo() {
    return this.video;
  }

  private emit(event: GestureEvent) {
    this.listeners.forEach((l) => l(event));
  }

  private keyFor(hand: string) {
    if (!this.smoothers.has(hand)) {
      const g = this.settings!;
      const profile = speedProfiles[g.speed];
      const beta = 0.02 + (1 - smoothingAlpha[g.smoothing]) * 0.05;
      this.smoothers.set(hand, new LandmarkSmoother(beta, profile.minCutoff));
      this.machines.set(
        hand,
        new GestureStateMachine({
          enter: g.confidence,
          exit: Math.max(0.15, g.confidence - 0.18),
          confirmFrames: profile.confirmFrames,
          cooldownMs: profile.cooldownMs,
        }),
      );
      const scale = sensitivityScale[g.sensitivity] * g.swipeSensitivity;
      this.swipes.set(
        hand,
        new SwipeDetector({
          minDisplacement: 0.13 / scale,
          minVelocity: 0.45 / scale,
          maxDurationMs: 300,
          cooldownMs: profile.swipeCooldownMs,
        }),
      );
      this.circles.set(hand, new CircleDetector());
      this.pinch.set(hand, new Smoothed(smoothingAlpha[g.smoothing]));
    }
    return hand;
  }

  /**
   * Schedule the next inference. Prefers requestVideoFrameCallback so we run
   * exactly once per camera frame (lower latency, no wasted GPU work).
   */
  private schedule() {
    const video = this.video as (HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    }) | null;
    if (!this.running || !video) return;
    if (typeof video.requestVideoFrameCallback === "function") {
      this.raf = video.requestVideoFrameCallback(() => this.loop());
    } else {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private loop = () => {
    if (!this.running || !this.video || !this.landmarker || !this.settings) return;
    this.schedule();

    const video = this.video;
    if (video.readyState < 2) return;
    const now = performance.now();
    const timestamp = Math.round(now);
    if (timestamp <= this.lastTimestamp) return;
    this.lastTimestamp = timestamp;

    const started = performance.now();
    let result;
    try {
      result = this.landmarker.detectForVideo(video, timestamp);
      this.errorStreak = 0;
    } catch {
      // Transient inference failures are normal (tab hidden, GPU context lost).
      // Only give up after a sustained streak so tracking recovers by itself.
      this.errorStreak += 1;
      if (this.errorStreak > 30) {
        this.errorStreak = 0;
        this.resetTracking();
      }
      return;
    }
    const processingMs = performance.now() - started;

    if (!result?.landmarks?.length) {
      // Hand lost: drop per-hand state so the next detection starts clean.
      this.resetTracking();
    }

    this.frameTimes.push(now);
    while (this.frameTimes.length && now - this.frameTimes[0]! > 1000) this.frameTimes.shift();


    const g = this.settings;
    const handednessList = result.handedness ?? result.handednesses ?? [];
    const frameHands: GestureFrame["hands"] = [];
    const poses: {
      label: "Left" | "Right";
      palm: { x: number; y: number; z: number };
      gesture: GestureName | null;
      pinching: boolean;
      openPalm: boolean;
      indexAngle: number;
    }[] = [];

    result.landmarks?.forEach((raw, index) => {
      const label = (handednessList[index]?.[0]?.categoryName === "Left" ? "Left" : "Right") as
        | "Left"
        | "Right";
      const key = this.keyFor(`${label}:${index}`);
      const landmarks = this.smoothers.get(key)!.smooth(raw, timestamp);
      const pose = analysePose(landmarks);
      if (!pose) return;

      const pinchRaw = pose.pinchDistance;
      const pinchSmoothed = this.pinch.get(key)!.push(pinchRaw);
      const normalisedPinch = Math.max(
        0,
        Math.min(1, (pinchSmoothed - g.pinchMin * 10) / Math.max(0.05, g.pinchMax * 10 - g.pinchMin * 10)),
      );

      const recognition = recognise(pose, g.enabledGestures);
      const machine = this.machines.get(key)!;
      const state = machine.update(recognition?.gesture ?? null, recognition?.confidence ?? 0, now);

      // mirrored so the pointer follows the user's own perspective
      const position = { x: 1 - pose.indexTip.x, y: pose.indexTip.y };
      const previous = this.lastPositions.get(key);
      const delta = previous
        ? { x: position.x - previous.x, y: position.y - previous.y }
        : { x: 0, y: 0 };
      const dt = previous ? Math.max(1, now - previous.t) / 1000 : 1;
      const velocity = { x: delta.x / dt, y: delta.y / dt };
      this.lastPositions.set(key, { ...position, t: now });

      const zone: HandZone = position.x < 0.34 ? "left" : position.x > 0.66 ? "right" : "center";
      // MediaPipe z is negative toward the camera; map to 0..1 proximity.
      const depth = Math.max(0, Math.min(1, 0.5 - pose.palmCenter.z * 4));

      if (state.gesture) {
        const heldMs = machine.heldMs(now);
        this.emit({
          type: "gesture",
          gesture: state.gesture,
          phase: state.phase,
          confidence: recognition?.confidence ?? 0,
          hand: label,
          position,
          delta,
          value: state.gesture === "PINCH" ? normalisedPinch : 1 - normalisedPinch,
          zone,
          depth,
          heldMs,
          timestamp: now,
        });

        // Hold → secondary action, emitted once per hold.
        if (heldMs >= g.holdMs && !this.holdFired.get(key)) {
          this.holdFired.set(key, true);
          this.emit({
            type: "gesture",
            gesture: state.gesture,
            phase: "ACTIVE",
            confidence: recognition?.confidence ?? 0,
            hand: label,
            position,
            delta,
            value: 1,
            variant: "HOLD",
            zone,
            depth,
            heldMs,
            timestamp: now,
          });
        }

        // Double pinch → double click.
        if (state.gesture === "PINCH" && state.phase === "CONFIRMED") {
          const previousTap = this.lastPinchTap.get(key) ?? 0;
          if (now - previousTap < 420) {
            this.lastPinchTap.set(key, 0);
            this.emit({
              type: "gesture",
              gesture: "PINCH",
              phase: "CONFIRMED",
              confidence: 1,
              hand: label,
              position,
              delta,
              value: 1,
              variant: "DOUBLE",
              zone,
              depth,
              timestamp: now,
            });
          } else {
            this.lastPinchTap.set(key, now);
          }
        }
      } else {
        this.holdFired.set(key, false);
      }

      // Circular fingertip motion → rotate / value dial.
      if (g.enabledGestures.CIRCLE && (state.gesture === "POINT" || state.gesture === "PINCH")) {
        const circle = this.circles.get(key)!.push(position.x, position.y, now);
        if (circle) {
          this.emit({
            type: "gesture",
            gesture: "CIRCLE",
            phase: "ACTIVE",
            confidence: 0.9,
            hand: label,
            position,
            delta,
            value: circle.angle,
            direction: circle.direction > 0 ? "RIGHT" : "LEFT",
            zone,
            depth,
            timestamp: now,
          });
        }
      }

      poses.push({
        label,
        palm: { x: 1 - pose.palmCenter.x, y: pose.palmCenter.y, z: pose.palmCenter.z },
        gesture: state.gesture,
        pinching: pose.pinchDistance < 0.6,
        openPalm: pose.extended.filter(Boolean).length >= 4,
        indexAngle: Math.atan2(pose.indexTip.y - pose.palmCenter.y, pose.indexTip.x - pose.palmCenter.x),
      });

      if (g.enabledGestures.SWIPE) {
        const direction = this.swipes
          .get(key)!
          .push(position.x, position.y, now);
        if (direction && (state.gesture === "OPEN_PALM" || state.gesture === "POINT" || !state.gesture)) {
          this.emit({
            type: "gesture",
            gesture: "SWIPE",
            phase: "CONFIRMED",
            confidence: 0.9,
            hand: label,
            position,
            delta,
            value: 1,
            direction,
            timestamp: now,
          });
        }
      }

      frameHands.push({
        hand: label,
        landmarks,
        pinchDistance: pinchSmoothed,
        velocity,
        gesture: state.gesture,
        confidence: recognition?.confidence ?? 0,
        phase: state.phase,
      });
    });

    // ---- Two-hand spatial controls -------------------------------------
    let twoHandDistance: number | null = null;
    if (poses.length === 2) {
      const [a, b] = poses as [(typeof poses)[number], (typeof poses)[number]];
      const dx = b.palm.x - a.palm.x;
      const dy = b.palm.y - a.palm.y;
      twoHandDistance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const midX = (a.palm.x + b.palm.x) / 2;
      const midY = (a.palm.y + b.palm.y) / 2;
      const position = { x: midX, y: midY };
      const bothPinch = a.pinching && b.pinching;
      const bothPalms = a.openPalm && b.openPalm;
      const previous = this.twoHandLast;

      if (previous) {
        const dDist = twoHandDistance - previous.dist;
        let dAngle = angle - previous.angle;
        if (dAngle > Math.PI) dAngle -= Math.PI * 2;
        if (dAngle < -Math.PI) dAngle += Math.PI * 2;
        const dMid = midX - previous.midX;

        // Both pinch + move apart/together → zoom.
        if (bothPinch && g.enabledGestures.TWO_HAND_ZOOM && Math.abs(dDist) > 0.002) {
          this.emit({
            type: "gesture",
            gesture: "TWO_HAND_ZOOM",
            phase: "ACTIVE",
            confidence: 0.95,
            hand: g.dominantHand,
            position,
            delta: { x: dDist, y: 0 },
            value: Math.max(0, Math.min(1, twoHandDistance / 0.8)),
            variant: dDist > 0 ? "IN" : "OUT",
            twoHand: true,
            timestamp: now,
          });
        }

        // Both hands twist → rotate 3D.
        if (bothPinch && g.enabledGestures.TWO_HAND_ROTATE && Math.abs(dAngle) > 0.004) {
          this.emit({
            type: "gesture",
            gesture: "TWO_HAND_ROTATE",
            phase: "ACTIVE",
            confidence: 0.95,
            hand: g.dominantHand,
            position,
            delta: { x: dAngle, y: 0 },
            value: angle,
            twoHand: true,
            timestamp: now,
          });
        }

        // Both palms: outward → expand, inward → collapse, together → resize.
        if (bothPalms && g.enabledGestures.TWO_PALMS) {
          if (Math.abs(dDist) > 0.006) {
            this.emit({
              type: "gesture",
              gesture: "TWO_PALMS",
              phase: "ACTIVE",
              confidence: 0.9,
              hand: g.dominantHand,
              position,
              delta: { x: dDist, y: 0 },
              value: twoHandDistance,
              variant: dDist > 0 ? "EXPAND" : "COLLAPSE",
              twoHand: true,
              timestamp: now,
            });
          } else if (Math.abs(dMid) > 0.004) {
            this.emit({
              type: "gesture",
              gesture: "TWO_PALMS",
              phase: "ACTIVE",
              confidence: 0.9,
              hand: g.dominantHand,
              position,
              delta: { x: dMid, y: 0 },
              value: twoHandDistance,
              variant: "RESIZE",
              twoHand: true,
              timestamp: now,
            });
          } else if (now - this.lastTwoHandGesture > 900) {
            // Both palms facing the screen, held still → emergency pause.
            this.lastTwoHandGesture = now;
            this.emit({
              type: "gesture",
              gesture: "TWO_PALMS",
              phase: "CONFIRMED",
              confidence: 0.95,
              hand: g.dominantHand,
              position,
              delta: { x: 0, y: 0 },
              value: 1,
              variant: "PAUSE",
              twoHand: true,
              timestamp: now,
            });
          }
        }

        // Clap: palms rushing together to near-contact.
        if (
          g.enabledGestures.CLAP &&
          bothPalms &&
          twoHandDistance < 0.16 &&
          dDist < -0.03 &&
          now - this.lastClap > 900
        ) {
          this.lastClap = now;
          this.emit({
            type: "gesture",
            gesture: "CLAP",
            phase: "CONFIRMED",
            confidence: 0.97,
            hand: g.dominantHand,
            position,
            delta: { x: dDist, y: 0 },
            value: 1,
            twoHand: true,
            timestamp: now,
          });
        }
      }

      // Both hands raised high → open main interface.
      if (
        g.enabledGestures.BOTH_RAISED &&
        a.palm.y < 0.32 &&
        b.palm.y < 0.32 &&
        now - this.lastBothRaised > 1400
      ) {
        this.lastBothRaised = now;
        this.emit({
          type: "gesture",
          gesture: "BOTH_RAISED",
          phase: "CONFIRMED",
          confidence: 0.95,
          hand: g.dominantHand,
          position,
          delta: { x: 0, y: 0 },
          value: 1,
          twoHand: true,
          timestamp: now,
        });
      }

      this.twoHandLast = { dist: twoHandDistance, angle, midX };
    } else {
      this.twoHandLast = null;
    }
    this.lastTwoHandDistance = twoHandDistance;

    if (this.frameListeners.size) {
      const frame: GestureFrame = {
        hands: frameHands,
        fps: this.frameTimes.length,
        processingMs,
        twoHandDistance,
        timestamp: now,
      };
      this.frameListeners.forEach((l) => l(frame));
    }
  };

  getCurrentGesture(): GestureName | null {
    for (const machine of this.machines.values()) {
      if (machine.activeGesture) return machine.activeGesture;
    }
    return null;
  }
}

export const GestureEngine = new GestureEngineImpl();

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
}