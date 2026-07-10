import type { PoseLandmarks } from '@pose-match/shared-types';
import { detectNative } from 'pose-detector';

export async function detectPose(imageBytes: Uint8Array): Promise<PoseLandmarks | null> {
  const result = await detectNative(imageBytes);
  if (!result) return null;
  return result.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility,
  }));
}
