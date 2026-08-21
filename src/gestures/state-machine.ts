import type { GestureName, GesturePhase } from "@/types/singulo";

interface Config {
  /** Confidence needed to enter DETECTED/CONFIRMED. */
  enter: number;
  /** Lower bound before release (hysteresis). */
  exit: number;
  /** Frames of agreement before CONFIRMED. */
  confirmFrames: number;
  cooldownMs: number;
}

/**
 * Per-gesture state machine:
 * IDLE → DETECTED → CONFIRMED → ACTIVE → RELEASED → COOLDOWN → IDLE
 * Hysteresis + frame agreement prevent flicker and repeated commands.
 */
export class GestureStateMachine {
  private phase: GesturePhase = "IDLE";
  private frames = 0;
  private cooldownUntil = 0;
  private current: GestureName | null = null;
  private enteredAt = 0;

  constructor(private config: Config) {}

  setTiming(confirmFrames: number, cooldownMs: number) {
    this.config.confirmFrames = confirmFrames;
    this.config.cooldownMs = cooldownMs;
  }

  /** Milliseconds the current gesture has been continuously held. */
  heldMs(now: number) {
    return this.enteredAt ? now - this.enteredAt : 0;
  }

  setThreshold(enter: number) {
    this.config.enter = enter;
    this.config.exit = Math.max(0.15, enter - 0.18);
  }

  get activeGesture() {
    return this.current;
  }

  get currentPhase() {
    return this.phase;
  }

  reset() {
    this.phase = "IDLE";
    this.frames = 0;
    this.current = null;
  }

  /** Feeds one frame of classification; returns the phase to emit. */
  update(
    gesture: GestureName | null,
    confidence: number,
    now: number,
  ): { gesture: GestureName | null; phase: GesturePhase; changed: boolean } {
    const previousPhase = this.phase;
    const previousGesture = this.current;

    if (this.phase === "COOLDOWN") {
      if (now >= this.cooldownUntil) {
        this.phase = "IDLE";
        this.current = null;
      }
      return { gesture: this.current, phase: this.phase, changed: this.phase !== previousPhase };
    }

    const holding = this.current !== null;
    const sustained = gesture === this.current && confidence >= this.config.exit;

    if (holding && !sustained) {
      this.phase = "RELEASED";
      this.frames = 0;
      this.cooldownUntil = now + this.config.cooldownMs;
      const released = { gesture: this.current, phase: this.phase, changed: true };
      this.phase = "COOLDOWN";
      return released;
    }

    if (!holding) {
      if (gesture && confidence >= this.config.enter) {
        this.frames = gesture === previousGesture ? this.frames + 1 : 1;
        if (gesture !== previousGesture) this.enteredAt = now;
        this.current = gesture;
        this.phase = this.frames >= this.config.confirmFrames ? "CONFIRMED" : "DETECTED";
      } else {
        this.frames = 0;
        this.phase = "IDLE";
        this.current = null;
      }
    } else if (this.phase === "CONFIRMED" || this.phase === "ACTIVE") {
      this.phase = "ACTIVE";
    } else {
      this.frames += 1;
      if (this.frames >= this.config.confirmFrames) this.phase = "CONFIRMED";
    }

    return {
      gesture: this.current,
      phase: this.phase,
      changed: this.phase !== previousPhase || this.current !== previousGesture,
    };
  }
}

export interface SwipeConfig {
  minDisplacement: number;
  minVelocity: number;
  maxDurationMs: number;
  cooldownMs: number;
}

/** Movement-over-time swipe detector with debounce. */
export class SwipeDetector {
  private samples: { x: number; y: number; t: number }[] = [];
  private lastFire = 0;

  constructor(private config: SwipeConfig) {}

  configure(patch: Partial<SwipeConfig>) {
    this.config = { ...this.config, ...patch };
  }

  reset() {
    this.samples = [];
  }

  push(x: number, y: number, now: number): "LEFT" | "RIGHT" | "UP" | "DOWN" | null {
    this.samples.push({ x, y, t: now });
    this.samples = this.samples.filter((s) => now - s.t <= this.config.maxDurationMs);
    if (now - this.lastFire < this.config.cooldownMs || this.samples.length < 4) return null;

    const first = this.samples[0]!;
    const dx = x - first.x;
    const dy = y - first.y;
    const dt = Math.max(1, now - first.t) / 1000;
    const vx = Math.abs(dx) / dt;
    const vy = Math.abs(dy) / dt;

    if (Math.abs(dx) > this.config.minDisplacement && vx > this.config.minVelocity && vx > vy) {
      this.lastFire = now;
      this.samples = [];
      return dx > 0 ? "RIGHT" : "LEFT";
    }
    if (Math.abs(dy) > this.config.minDisplacement && vy > this.config.minVelocity && vy > vx) {
      this.lastFire = now;
      this.samples = [];
      return dy > 0 ? "DOWN" : "UP";
    }
    return null;
  }
}

/** Detects sustained circular motion of a fingertip (rotate / value dial). */
export class CircleDetector {
  private samples: { x: number; y: number; t: number }[] = [];
  private lastFire = 0;

  constructor(private windowMs = 900) {}

  reset() {
    this.samples = [];
  }

  /** Returns accumulated signed angle (radians) once a loop-like motion is seen. */
  push(x: number, y: number, now: number): { angle: number; direction: 1 | -1 } | null {
    this.samples.push({ x, y, t: now });
    this.samples = this.samples.filter((s) => now - s.t <= this.windowMs);
    if (this.samples.length < 8) return null;

    const cx = this.samples.reduce((n, s) => n + s.x, 0) / this.samples.length;
    const cy = this.samples.reduce((n, s) => n + s.y, 0) / this.samples.length;
    const radius =
      this.samples.reduce((n, s) => n + Math.hypot(s.x - cx, s.y - cy), 0) / this.samples.length;
    if (radius < 0.03) return null;

    let total = 0;
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1]!;
      const b = this.samples[i]!;
      const a1 = Math.atan2(a.y - cy, a.x - cx);
      const a2 = Math.atan2(b.y - cy, b.x - cx);
      let d = a2 - a1;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      total += d;
    }
    if (Math.abs(total) < 1.2 || now - this.lastFire < 90) return null;
    this.lastFire = now;
    return { angle: total, direction: total > 0 ? 1 : -1 };
  }
}
