import type { GestureName } from "@/types/singulo";

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface HandPose {
  extended: boolean[]; // thumb, index, middle, ring, pinky
  pinchDistance: number; // normalised by hand size
  palmSpread: number;
  indexTip: Point;
  thumbTip: Point;
  wrist: Point;
  palmCenter: Point;
  handSize: number;
  /** Positive when the thumb points up on screen. */
  thumbUpness: number;
}

const TIPS = [4, 8, 12, 16, 20];
const PIPS = [2, 6, 10, 14, 18];

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Derives orientation-independent pose features from normalised landmarks.
 * All distances are divided by hand size so behaviour is stable regardless of
 * camera resolution or how far the hand is from the lens.
 */
export function analysePose(landmarks: Point[]): HandPose | null {
  if (landmarks.length < 21) return null;
  const wrist = landmarks[0]!;
  const middleMcp = landmarks[9]!;
  const handSize = Math.max(1e-4, dist(wrist, middleMcp));

  const extended = TIPS.map((tip, i) => {
    const tipPoint = landmarks[tip]!;
    const pipPoint = landmarks[PIPS[i]!]!;
    if (i === 0) {
      // thumb: compare lateral distance from the index MCP
      return dist(tipPoint, landmarks[5]!) / handSize > 0.95;
    }
    return dist(tipPoint, wrist) / handSize > dist(pipPoint, wrist) / handSize + 0.25;
  });

  const palmCenter = {
    x: (wrist.x + middleMcp.x + landmarks[5]!.x + landmarks[17]!.x) / 4,
    y: (wrist.y + middleMcp.y + landmarks[5]!.y + landmarks[17]!.y) / 4,
    z: (wrist.z + middleMcp.z + landmarks[5]!.z + landmarks[17]!.z) / 4,
  };

  return {
    extended,
    pinchDistance: dist(landmarks[4]!, landmarks[8]!) / handSize,
    palmSpread: dist(landmarks[8]!, landmarks[20]!) / handSize,
    indexTip: landmarks[8]!,
    thumbTip: landmarks[4]!,
    wrist,
    thumbUpness: (wrist.y - landmarks[4]!.y) / handSize,
    palmCenter,
    handSize,
  };
}

export interface Recognition {
  gesture: GestureName;
  confidence: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Each recognizer returns a confidence in 0..1; the router picks a winner. */
export const recognizers: {
  gesture: GestureName;
  priority: number;
  score: (pose: HandPose) => number;
}[] = [
  {
    gesture: "PINCH",
    priority: 5,
    score: (pose) => {
      const closeness = clamp01((0.62 - pose.pinchDistance) / 0.42);
      const fingersOk = pose.extended[2] || pose.extended[3] ? 0.85 : 1;
      return closeness * fingersOk;
    },
  },
  {
    gesture: "POINT",
    priority: 4,
    score: (pose) => {
      const [thumb, index, middle, ring, pinky] = pose.extended;
      if (!index) return 0;
      const folded = [middle, ring, pinky].filter((f) => !f).length / 3;
      const notPinching = clamp01((pose.pinchDistance - 0.55) / 0.4);
      return clamp01(folded * (thumb ? 0.85 : 1) * notPinching);
    },
  },
  {
    gesture: "VICTORY",
    priority: 3,
    score: (pose) => {
      const [, index, middle, ring, pinky] = pose.extended;
      if (!index || !middle) return 0;
      const folded = [ring, pinky].filter((f) => !f).length / 2;
      return clamp01(folded * clamp01(pose.palmSpread / 1.4));
    },
  },
  {
    gesture: "THUMB_UP",
    priority: 6,
    score: (pose) => {
      const [thumb, index, middle, ring, pinky] = pose.extended;
      if (!thumb) return 0;
      const folded = [index, middle, ring, pinky].filter((f) => !f).length / 4;
      if (folded < 0.75) return 0;
      return clamp01(folded * clamp01((pose.thumbUpness - 0.35) / 0.9));
    },
  },
  {
    gesture: "THUMB_DOWN",
    priority: 6,
    score: (pose) => {
      const [thumb, index, middle, ring, pinky] = pose.extended;
      if (!thumb) return 0;
      const folded = [index, middle, ring, pinky].filter((f) => !f).length / 4;
      if (folded < 0.75) return 0;
      return clamp01(folded * clamp01((-pose.thumbUpness - 0.35) / 0.9));
    },
  },
  {
    gesture: "THREE_FINGERS",
    priority: 4,
    score: (pose) => {
      const [, index, middle, ring, pinky] = pose.extended;
      if (!index || !middle || !ring || pinky) return 0;
      return clamp01(0.6 + clamp01(pose.palmSpread / 1.6) * 0.4);
    },
  },
  {
    gesture: "OPEN_PALM",
    priority: 2,
    score: (pose) => {
      const count = pose.extended.filter(Boolean).length;
      if (count < 4) return 0;
      return clamp01((count - 3) / 2) * clamp01(pose.palmSpread / 1.6);
    },
  },
  {
    gesture: "FIST",
    priority: 2,
    score: (pose) => {
      const folded = pose.extended.filter((f) => !f).length;
      if (folded < 4) return 0;
      return clamp01(folded / 5) * clamp01((0.9 - pose.pinchDistance) / 0.6);
    },
  },
];

/** Resolves conflicts by confidence, then by declared priority. */
export function recognise(
  pose: HandPose,
  enabled: Record<GestureName, boolean>,
): Recognition | null {
  let best: (Recognition & { priority: number }) | null = null;
  for (const r of recognizers) {
    if (!enabled[r.gesture]) continue;
    const confidence = r.score(pose);
    if (confidence <= 0.05) continue;
    if (
      !best ||
      confidence > best.confidence + 0.08 ||
      (Math.abs(confidence - best.confidence) <= 0.08 && r.priority > best.priority)
    ) {
      best = { gesture: r.gesture, confidence, priority: r.priority };
    }
  }
  return best ? { gesture: best.gesture, confidence: best.confidence } : null;
}