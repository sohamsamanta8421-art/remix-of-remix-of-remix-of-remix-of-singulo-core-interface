/**
 * Pure motion math shared by the visual core and its regression tests.
 * Keeping it here (instead of inline in core-engine.ts) means the auto-recenter
 * timing and loop damping can be verified without a WebGL context.
 */

/** Exponential damping that is independent of frame rate. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

/** How long after the last user input the view starts drifting home. */
export const RECENTER_DELAY_MS = 1200;
/** Damping used while drifting targets back to rest. */
export const RECENTER_LAMBDA = 2.2;
/** Damping used to follow the targets — high so the core feels instant. */
export const VIEW_LAMBDA = 14;

export interface ViewTargets {
  zoom: number;
  rotation: { x: number; y: number };
  pan: { x: number; y: number };
}

export const REST_VIEW: ViewTargets = {
  zoom: 1,
  rotation: { x: -0.1, y: 0 },
  pan: { x: 0, y: 0 },
};

/**
 * Drifts the targets back toward rest once the input is stale.
 * Returns true when recentering was applied this frame.
 */
export function recenterTargets(targets: ViewTargets, dt: number, msSinceInput: number) {
  if (msSinceInput <= RECENTER_DELAY_MS) return false;
  targets.zoom = damp(targets.zoom, REST_VIEW.zoom, RECENTER_LAMBDA, dt);
  targets.rotation.x = damp(targets.rotation.x, REST_VIEW.rotation.x, RECENTER_LAMBDA, dt);
  targets.rotation.y = damp(targets.rotation.y, REST_VIEW.rotation.y, RECENTER_LAMBDA, dt);
  targets.pan.x = damp(targets.pan.x, REST_VIEW.pan.x, RECENTER_LAMBDA, dt);
  targets.pan.y = damp(targets.pan.y, REST_VIEW.pan.y, RECENTER_LAMBDA, dt);
  return true;
}

/** Moves the live view toward its targets with the loop damping. */
export function followTargets(view: ViewTargets, targets: ViewTargets, dt: number) {
  view.zoom = damp(view.zoom, targets.zoom, VIEW_LAMBDA, dt);
  view.rotation.x = damp(view.rotation.x, targets.rotation.x, VIEW_LAMBDA, dt);
  view.rotation.y = damp(view.rotation.y, targets.rotation.y, VIEW_LAMBDA, dt);
  view.pan.x = damp(view.pan.x, targets.pan.x, VIEW_LAMBDA, dt);
  view.pan.y = damp(view.pan.y, targets.pan.y, VIEW_LAMBDA, dt);
}

/** Largest absolute gap between the live view and its targets. */
export function viewError(view: ViewTargets, targets: ViewTargets) {
  return Math.max(
    Math.abs(view.zoom - targets.zoom),
    Math.abs(view.rotation.x - targets.rotation.x),
    Math.abs(view.rotation.y - targets.rotation.y),
    Math.abs(view.pan.x - targets.pan.x),
    Math.abs(view.pan.y - targets.pan.y),
  );
}
