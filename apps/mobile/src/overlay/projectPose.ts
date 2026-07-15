import type { BoundingBox, PoseLandmarks } from '@pose-match/shared-types';

const MIN_VISIBILITY = 0.3;

/** Tight box around visible body joints (normalized 0–1 coords). */
export function landmarksBBox(landmarks: PoseLandmarks): BoundingBox | null {
  'worklet';
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
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

  if (!found) return null;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return null;

  return { x: minX, y: minY, w, h };
}

/**
 * Stretch/shift the target pose so it sits in the same place/size as the live person.
 * Both inputs use normalized 0–1 image coordinates.
 */
export function projectTargetOntoLive(
  target: PoseLandmarks,
  live: PoseLandmarks,
): PoseLandmarks | null {
  'worklet';
  const targetBox = landmarksBBox(target);
  const liveBox = landmarksBBox(live);
  if (!targetBox || !liveBox) return null;

  const scaleX = liveBox.w / targetBox.w;
  const scaleY = liveBox.h / targetBox.h;

  const out: PoseLandmarks = [];
  for (let i = 0; i < target.length; i++) {
    const kp = target[i];
    out.push({
      x: liveBox.x + (kp.x - targetBox.x) * scaleX,
      y: liveBox.y + (kp.y - targetBox.y) * scaleY,
      z: kp.z,
      visibility: kp.visibility,
    });
  }
  return out;
}
