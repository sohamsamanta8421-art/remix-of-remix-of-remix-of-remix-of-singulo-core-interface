export interface Vec2 {
  x: number;
  y: number;
}

/** One Euro filter: low jitter at rest, low lag while moving. */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(
    private minCutoff = 1.2,
    private beta = 0.03,
    private dCutoff = 1,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
  }

  filter(value: number, timestampMs: number): number {
    if (this.xPrev === null) {
      this.xPrev = value;
      this.tPrev = timestampMs;
      return value;
    }
    const dt = Math.max(1, timestampMs - this.tPrev) / 1000;
    this.tPrev = timestampMs;

    const dx = (value - this.xPrev) / dt;
    const aD = OneEuroFilter.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuroFilter.alpha(cutoff, dt);
    const xHat = a * value + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }
}

/** Exponential smoothing for scalar control values (pinch distance, zoom). */
export class Smoothed {
  private value: number | null = null;
  constructor(private alpha: number) {}
  setAlpha(alpha: number) {
    this.alpha = alpha;
  }
  reset() {
    this.value = null;
  }
  push(next: number): number {
    this.value = this.value === null ? next : this.alpha * next + (1 - this.alpha) * this.value;
    return this.value;
  }
  get current() {
    return this.value ?? 0;
  }
}

export class LandmarkSmoother {
  private filters: { x: OneEuroFilter; y: OneEuroFilter; z: OneEuroFilter }[] = [];

  constructor(
    private beta: number,
    private minCutoff = 1.2,
  ) {}

  setBeta(beta: number, minCutoff = this.minCutoff) {
    if (beta === this.beta && minCutoff === this.minCutoff) return;
    this.beta = beta;
    this.minCutoff = minCutoff;
    this.filters = [];
  }

  smooth(points: { x: number; y: number; z: number }[], timestampMs: number) {
    if (this.filters.length !== points.length) {
      this.filters = points.map(() => ({
        x: new OneEuroFilter(this.minCutoff, this.beta),
        y: new OneEuroFilter(this.minCutoff, this.beta),
        z: new OneEuroFilter(this.minCutoff, this.beta),
      }));
    }
    return points.map((point, i) => {
      const f = this.filters[i]!;
      return {
        x: f.x.filter(point.x, timestampMs),
        y: f.y.filter(point.y, timestampMs),
        z: f.z.filter(point.z, timestampMs),
      };
    });
  }
}