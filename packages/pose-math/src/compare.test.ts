import type { Keypoint, PoseLandmarks } from '@pose-match/shared-types';
import { describe, expect, it } from 'vitest';
import { getJointAngles, JOINT_TRIPLETS, type JointName } from './angles';
import { compareJointAngles, comparePoses } from './compare';
import { normalize } from './normalize';

function kp(x: number, y: number): Keypoint {
  return { x, y, visibility: 1 };
}

function emptyLandmarks(): PoseLandmarks {
  return Array.from({ length: 33 }, () => kp(0, 0));
}

function asymmetricPose(): PoseLandmarks {
  const landmarks = emptyLandmarks();
  landmarks[11] = kp(-1, 0);
  landmarks[12] = kp(1, -1);
  landmarks[13] = kp(-2, 1);
  landmarks[14] = kp(2, 0);
  landmarks[15] = kp(-3, 2);
  landmarks[16] = kp(3, -1);
  landmarks[23] = kp(-0.5, 2);
  landmarks[24] = kp(0.5, 2);
  landmarks[25] = kp(-1, 3);
  landmarks[26] = kp(1, 5);
  landmarks[27] = kp(-1, 5);
  landmarks[28] = kp(1, 7);
  return landmarks;
}

function swapJointSides(
  angles: Record<JointName, number>,
): Record<JointName, number> {
  return {
    left_shoulder: angles.right_shoulder,
    right_shoulder: angles.left_shoulder,
    left_elbow: angles.right_elbow,
    right_elbow: angles.left_elbow,
    left_hip: angles.right_hip,
    right_hip: angles.left_hip,
    left_knee: angles.right_knee,
    right_knee: angles.left_knee,
  };
}

function allJointNames(): JointName[] {
  return Object.keys(JOINT_TRIPLETS) as JointName[];
}

describe('comparePoses', () => {
  it('returns score 100 for identical poses', () => {
    const pose = asymmetricPose();
    const { score } = comparePoses(pose, pose);
    expect(score).toBeCloseTo(100, 6);
  });

  it('returns score 0 when every joint is 60° off', () => {
    const targetAngles = getJointAngles(normalize(asymmetricPose()));
    const liveAngles = {} as Record<JointName, number>;

    for (const joint of allJointNames()) {
      liveAngles[joint] = targetAngles[joint] + 60;
    }

    const { score, jointDiffs } = compareJointAngles(targetAngles, liveAngles);

    for (const joint of allJointNames()) {
      expect(jointDiffs[joint]).toBeCloseTo(60, 6);
    }
    expect(score).toBeCloseTo(0, 6);
  });

  it('returns score < 50 for left/right flipped pose', () => {
    const target = asymmetricPose();
    const targetAngles = getJointAngles(normalize(target));
    const { score } = compareJointAngles(
      targetAngles,
      swapJointSides(targetAngles),
    );
    expect(score).toBeLessThan(50);
  });
});
