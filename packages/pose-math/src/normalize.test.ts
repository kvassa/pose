import type { Keypoint, PoseLandmarks } from '@pose-match/shared-types';
import { describe, expect, it } from 'vitest';
import { centerOnHip, normalize } from './normalize';

function kp(x: number, y: number): Keypoint {
  return { x, y, visibility: 1 };
}

function syntheticLandmarks(): PoseLandmarks {
  const landmarks = Array.from({ length: 33 }, (_, i) => kp(i * 0.1, i * 0.2));
  landmarks[11] = kp(20, 0);
  landmarks[12] = kp(20, 10);
  landmarks[23] = kp(10, 20);
  landmarks[24] = kp(30, 40);
  return landmarks;
}

describe('centerOnHip', () => {
  it('re-centers so hip midpoint is at origin', () => {
    const centered = centerOnHip(syntheticLandmarks());
    const midX = (centered[23].x + centered[24].x) / 2;
    const midY = (centered[23].y + centered[24].y) / 2;
    expect(midX).toBeCloseTo(0, 6);
    expect(midY).toBeCloseTo(0, 6);
  });
});

describe('normalize', () => {
  it('scales so shoulder midpoint is one unit from hip origin', () => {
    const normalized = normalize(syntheticLandmarks());
    const shoulderMidX = (normalized[11].x + normalized[12].x) / 2;
    const shoulderMidY = (normalized[11].y + normalized[12].y) / 2;
    const dist = Math.hypot(shoulderMidX, shoulderMidY);
    expect(dist).toBeCloseTo(1, 6);
  });
});
