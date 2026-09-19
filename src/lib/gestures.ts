export type Point = { x: number; y: number; z?: number };
export type Gesture = "pause" | "resume" | "next" | "previous" | "volumeUp" | "volumeDown" | "mute";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function classifyGesture(points: Point[]): Gesture | null {
  if (points.length < 21) return null;
  const wrist = points[0];
  const tips = [8, 12, 16, 20];
  const folded = tips.map((tip) => distance(points[tip], wrist) < distance(points[tip - 2], wrist));
  const extendedCount = folded.filter((value) => !value).length;
  const thumb = points[4];
  const index = points[8];
  const middle = points[12];

  if (extendedCount === 0) return "pause";
  if (extendedCount >= 4 && points[8].y < points[0].y) return "resume";
  if (!folded[0] && folded.slice(1).every(Boolean)) {
    if (thumb.x - wrist.x > 0.12) return "next";
    if (wrist.x - thumb.x > 0.12) return "previous";
  }
  const vShape = !folded[1] && !folded[2];
  if (vShape && distance(index, middle) < 0.045) return "mute";
  if (vShape && distance(index, middle) > 0.08 && index.y < wrist.y - 0.12 && middle.y < wrist.y - 0.12) return "volumeUp";
  if (vShape && distance(index, middle) > 0.08 && index.y > wrist.y + 0.12 && middle.y > wrist.y + 0.12) return "volumeDown";
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
