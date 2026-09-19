export type Point = { x: number; y: number; z?: number };
export type Gesture = "pause" | "resume" | "next" | "previous" | "volumeUp" | "volumeDown" | "mute";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function classifyGesture(points: Point[]): Gesture | null {
  if (points.length < 21) return null;
  const wrist = points[0];
  const tips = [8, 12, 16, 20];
  const folded = tips.map((tip) => distance(points[tip], wrist) < distance(points[tip - 2], wrist));
  const extendedCount = folded.filter((value) => !value).length;
  const index = points[8];
  const middle = points[12];

  const thumbExtended = distance(points[4], wrist) > distance(points[3], wrist);
  if (thumbExtended && folded.every(Boolean)) {
    const thumbDirection = points[4].x - points[2].x;
    if (thumbDirection > 0.08) return "previous";
    if (thumbDirection < -0.08) return "next";
  }

  if (extendedCount === 0) return "pause";
  if (extendedCount === 4) return "resume";

  const vShape = !folded[0] && !folded[1] && folded[2] && folded[3];
  if (vShape && distance(index, middle) < 0.045) return "mute";
  if (vShape && distance(index, middle) > 0.08 && index.y < wrist.y - 0.1 && middle.y < wrist.y - 0.1) return "volumeUp";
  if (vShape && distance(index, middle) > 0.08 && index.y > wrist.y + 0.1 && middle.y > wrist.y + 0.1) return "volumeDown";
  return null;
}

export function gestureLabel(gesture: Gesture | null) {
  return gesture ? {
    pause: "Pause",
    resume: "Resume",
    next: "Next track",
    previous: "Previous track",
    volumeUp: "Volume up",
    volumeDown: "Volume down",
    mute: "Mute",
  }[gesture] : "No gesture";
}
