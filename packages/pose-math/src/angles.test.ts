import type { Keypoint, PoseLandmarks } from '@pose-match/shared-types';
import { describe, expect, it } from 'vitest';
import { getJointAngles } from './angles';

function kp(x: number, y: number): Keypoint {
  return { x, y, visibility: 1 };
}

function emptyLandmarks(): PoseLandmarks {
  return Array.from({ length: 33 }, () => kp(0, 0));
}

describe('getJointAngles', () => {
  it('returns ~90° for a right-angle left elbow', () => {
    const landmarks = emptyLandmarks();
    landmarks[11] = kp(0, 0);
    landmarks[13] = kp(1, 0);
    landmarks[15] = kp(1, 1);

    const angles = getJointAngles(landmarks);
    expect(angles.left_elbow).toBeCloseTo(90, 6);
  });
});
