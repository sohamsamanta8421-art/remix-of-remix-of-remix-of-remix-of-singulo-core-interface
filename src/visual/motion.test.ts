import { describe, expect, it } from "vitest";
import {
  damp,
  followTargets,
  RECENTER_DELAY_MS,
  recenterTargets,
  REST_VIEW,
  VIEW_LAMBDA,
  viewError,
  type ViewTargets,
} from "./motion";

const nudged = (): ViewTargets => ({
  zoom: 2.4,
  rotation: { x: 0.8, y: 1.2 },
  pan: { x: 1.5, y: -1.2 },
});

const step = 1 / 60;

describe("auto-recenter timing", () => {
  it("leaves targets untouched while input is fresh", () => {
    const targets = nudged();
    const applied = recenterTargets(targets, step, 300);
    expect(applied).toBe(false);
    expect(targets).toEqual(nudged());
  });

  it("does not recenter exactly at the delay boundary", () => {
    const targets = nudged();
    expect(recenterTargets(targets, step, RECENTER_DELAY_MS)).toBe(false);
    expect(recenterTargets(targets, step, RECENTER_DELAY_MS + 1)).toBe(true);
  });

  it("drifts targets home after the delay", () => {
    const targets = nudged();
    let elapsed = RECENTER_DELAY_MS + 1;
    for (let i = 0; i < 240; i++) {
      recenterTargets(targets, step, elapsed);
      elapsed += step * 1000;
    }
    expect(targets.zoom).toBeCloseTo(REST_VIEW.zoom, 2);
    expect(targets.rotation.x).toBeCloseTo(REST_VIEW.rotation.x, 2);
    expect(targets.rotation.y).toBeCloseTo(REST_VIEW.rotation.y, 2);
    expect(targets.pan.x).toBeCloseTo(REST_VIEW.pan.x, 2);
    expect(targets.pan.y).toBeCloseTo(REST_VIEW.pan.y, 2);
  });

  it("takes roughly 1.5s of drift to be mostly home (not instant, not sluggish)", () => {
    const targets = nudged();
    let elapsed = RECENTER_DELAY_MS + 1;
    let frames = 0;
    while (viewError(targets, REST_VIEW) > 0.05 && frames < 600) {
      recenterTargets(targets, step, elapsed);
      elapsed += step * 1000;
      frames++;
    }
    const seconds = frames * step;
    expect(seconds).toBeGreaterThan(0.8);
    expect(seconds).toBeLessThan(3);
  });
});

describe("loop damping", () => {
  it("is frame-rate independent", () => {
    const a = damp(0, 1, VIEW_LAMBDA, 1 / 30);
    let b = 0;
    b = damp(b, 1, VIEW_LAMBDA, 1 / 60);
    b = damp(b, 1, VIEW_LAMBDA, 1 / 60);
    expect(b).toBeCloseTo(a, 6);
  });

  it("closes 90% of the gap within 200ms after input", () => {
    const view: ViewTargets = { zoom: 1, rotation: { x: -0.1, y: 0 }, pan: { x: 0, y: 0 } };
    const targets = nudged();
    for (let t = 0; t < 0.2; t += step) followTargets(view, targets, step);
    const initial = viewError(
      { zoom: 1, rotation: { x: -0.1, y: 0 }, pan: { x: 0, y: 0 } },
      targets,
    );
    expect(viewError(view, targets)).toBeLessThan(initial * 0.1);
  });

  it("never overshoots the target", () => {
    const view: ViewTargets = { zoom: 1, rotation: { x: -0.1, y: 0 }, pan: { x: 0, y: 0 } };
    const targets = nudged();
    for (let i = 0; i < 120; i++) {
      followTargets(view, targets, step);
      expect(view.zoom).toBeLessThanOrEqual(targets.zoom + 1e-9);
      expect(view.pan.y).toBeGreaterThanOrEqual(targets.pan.y - 1e-9);
    }
  });

  it("settles the view even while the targets are recentering", () => {
    const view: ViewTargets = { zoom: 1, rotation: { x: -0.1, y: 0 }, pan: { x: 0, y: 0 } };
    const targets = nudged();
    let elapsed = 0;
    for (let i = 0; i < 600; i++) {
      recenterTargets(targets, step, elapsed);
      followTargets(view, targets, step);
      elapsed += step * 1000;
    }
    expect(viewError(view, REST_VIEW)).toBeLessThan(0.02);
  });
});
