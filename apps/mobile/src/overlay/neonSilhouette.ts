import type { PoseLandmarks } from '@pose-match/shared-types';
import { Skia, type SkPath } from '@shopify/react-native-skia';

const MIN_VISIBILITY = 0.3;

/** Body bone pairs for neon silhouette (rounded pill limbs). */
export const NEON_LIMB_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [11, 12],
  [23, 24],
  [11, 23],
  [12, 24],
];

type Point = { x: number; y: number };

function kpPoint(
  landmarks: PoseLandmarks,
  index: number,
  width: number,
  height: number,
  padX: number,
  padY: number,
): Point | null {
  'worklet';
  const kp = landmarks[index];
  if (!kp || kp.visibility < MIN_VISIBILITY) return null;
  return {
    x: padX + kp.x * width,
    y: padY + kp.y * height,
  };
}

/**
 * Fit reference landmarks into a local guide box (width x height),
 * preserving aspect via letterboxing inside the guide.
 */
export function guideLandmarkLayout(
  landmarks: PoseLandmarks,
  boxW: number,
  boxH: number,
): { width: number; height: number; padX: number; padY: number } {
  'worklet';
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let i = 0; i < landmarks.length; i++) {
    const kp = landmarks[i];
    if (kp.visibility < MIN_VISIBILITY) continue;
    found = true;
    if (kp.x < minX) minX = kp.x;
    if (kp.y < minY) minY = kp.y;
    if (kp.x > maxX) maxX = kp.x;
    if (kp.y > maxY) maxY = kp.y;
  }
  if (!found) {
    return { width: boxW, height: boxH, padX: 0, padY: 0 };
  }

  const margin = 0.08;
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(1, maxX + margin);
  maxY = Math.min(1, maxY + margin);

  // We still map full 0–1 image space into the guide so photo + neon stay aligned.
  return { width: boxW, height: boxH, padX: 0, padY: 0 };
}

export function buildNeonLimbPath(
  landmarks: PoseLandmarks,
  boxW: number,
  boxH: number,
): SkPath {
  'worklet';
  const layout = guideLandmarkLayout(landmarks, boxW, boxH);
  const path = Skia.Path.Make();
  for (let i = 0; i < NEON_LIMB_PAIRS.length; i++) {
    const pair = NEON_LIMB_PAIRS[i];
    const p1 = kpPoint(landmarks, pair[0], layout.width, layout.height, layout.padX, layout.padY);
    const p2 = kpPoint(landmarks, pair[1], layout.width, layout.height, layout.padX, layout.padY);
    if (!p1 || !p2) continue;
    path.moveTo(p1.x, p1.y);
    path.lineTo(p2.x, p2.y);
  }
  return path;
}

export function buildNeonTorsoFill(
  landmarks: PoseLandmarks,
  boxW: number,
  boxH: number,
): SkPath {
  'worklet';
  const layout = guideLandmarkLayout(landmarks, boxW, boxH);
  const ls = kpPoint(landmarks, 11, layout.width, layout.height, layout.padX, layout.padY);
  const rs = kpPoint(landmarks, 12, layout.width, layout.height, layout.padX, layout.padY);
  const lh = kpPoint(landmarks, 23, layout.width, layout.height, layout.padX, layout.padY);
  const rh = kpPoint(landmarks, 24, layout.width, layout.height, layout.padX, layout.padY);
  if (!ls || !rs || !lh || !rh) return Skia.Path.Make();

  const path = Skia.Path.Make();
  // Soft rounded feel via midpoints (diamond-ish rounded torso)
  const topX = (ls.x + rs.x) / 2;
  const topY = Math.min(ls.y, rs.y) - 8;
  path.moveTo(ls.x, ls.y);
  path.quadTo(topX, topY, rs.x, rs.y);
  path.lineTo(rh.x, rh.y);
  path.quadTo((lh.x + rh.x) / 2, Math.max(lh.y, rh.y) + 6, lh.x, lh.y);
  path.close();
  return path;
}

export function neonHeadCenter(
  landmarks: PoseLandmarks,
  boxW: number,
  boxH: number,
): Point | null {
  'worklet';
  const layout = guideLandmarkLayout(landmarks, boxW, boxH);
  const nose = kpPoint(landmarks, 0, layout.width, layout.height, layout.padX, layout.padY);
  if (nose) return nose;
  const ls = kpPoint(landmarks, 11, layout.width, layout.height, layout.padX, layout.padY);
  const rs = kpPoint(landmarks, 12, layout.width, layout.height, layout.padX, layout.padY);
  if (!ls || !rs) return null;
  return { x: (ls.x + rs.x) / 2, y: Math.min(ls.y, rs.y) - 28 };
}

export function neonHeadRadius(
  landmarks: PoseLandmarks,
  boxW: number,
  boxH: number,
): number {
  'worklet';
  const layout = guideLandmarkLayout(landmarks, boxW, boxH);
  const ls = kpPoint(landmarks, 11, layout.width, layout.height, layout.padX, layout.padY);
  const rs = kpPoint(landmarks, 12, layout.width, layout.height, layout.padX, layout.padY);
  if (!ls || !rs) return Math.min(boxW, boxH) * 0.08;
  const shoulderW = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  return Math.max(16, shoulderW * 0.28);
}
