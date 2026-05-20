import type { PoseLandmarks } from '@pose-match/shared-types';
import { getJointAngles, type JointName } from './angles';
import { normalize } from './normalize';

const MAX_PENALTY_DEG = 60;

export type CompareResult = {
  score: number;
  jointDiffs: Record<JointName, number>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function compareJointAngles(
  targetAngles: Record<JointName, number>,
  liveAngles: Record<JointName, number>,
): CompareResult {
  const joints = Object.keys(targetAngles) as JointName[];
  const jointDiffs = {} as Record<JointName, number>;
  let sumDiff = 0;

  for (const joint of joints) {
    const diff = Math.abs(targetAngles[joint] - liveAngles[joint]);
    jointDiffs[joint] = diff;
    sumDiff += diff;
  }

  const meanDiff = sumDiff / joints.length;
  const score = 100 * (1 - clamp(meanDiff / MAX_PENALTY_DEG, 0, 1));

  return { score, jointDiffs };
}

export function comparePoses(
  target: PoseLandmarks,
  live: PoseLandmarks,
): CompareResult {
  return compareJointAngles(
    getJointAngles(normalize(target)),
    getJointAngles(normalize(live)),
  );
}
